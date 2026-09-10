import test from 'node:test';
import assert from 'node:assert/strict';
import { DynamoDBDocumentClient, GetCommand, QueryCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoContestRepository, keys, encodeContest, decodeContest, buildCardTransaction, RepositoryError } from './dynamo.js';
import { fixture } from '../../domain/src/fixture.js';
import type { Contest, ContestParticipant } from '../../domain/src/index.js';
const at = new Date('2026-09-12T15:00:00Z');
const contest: Contest = { id: 'week', name: 'Week', timezone: 'UTC', lockAt: '2026-09-12T16:00:00Z', version: 1, phase: 'PREGAME' };
const participant: ContestParticipant = { contestId: 'week', participantId: 'player', playerId: 'person', displayName: 'Player', attendance: 'ON_SITE', status: 'ACTIVE', cardRevision: 0, submissionStatus: 'DRAFT' };
function records() {
  const { c, card } = fixture();
  const items = [...encodeContest(contest, c), { ...keys.participant('week','player'), data: participant }];
  return { items, card };
}
function client(send: (command: any) => Promise<any>) { return { send } as unknown as Pick<DynamoDBDocumentClient,'send'>; }

test('keys isolate current picks, history and hashed sessions; delimiter injection rejected', () => {
  assert.deepEqual(keys.pick('week','person','slot'), { PK: 'CONTEST#week', SK: 'PICK#person#slot' });
  assert.equal(keys.history('week','person','slot',at.toISOString(),'1').PK, 'PICKHISTORY#week#person');
  assert.match(keys.session('secret').PK, /^SESSION#[a-f0-9]{64}$/);
  assert.equal(keys.session('secret').PK.includes('secret'), false);
  assert.throws(() => keys.pick('week','a#b','slot'));
});
test('physical contest records round-trip configuration without embedding histories or session secrets', () => {
  const { items } = records(); const snapshot = decodeContest(items);
  assert.equal(snapshot.configuration.slots.length, 15);
  assert.deepEqual(snapshot.cards.player, { picks: [] });
  assert.equal(items.some(i => i.PK.startsWith('PICKHISTORY#') || i.PK.startsWith('SESSION#')), false);
});
test('whole-card write atomically guards lock, increments version and writes per-slot history within transaction limits', () => {
  const { items, card } = records();
  const writes = buildCardTransaction('table', decodeContest(items), { contestId: 'week', participantId: 'player', expectedCardRevision: 0, card }, at);
  assert.equal(writes.length, 33);
  const meta = writes[0]!.Update!;
  assert.match(meta.ConditionExpression!, /lockAtMs > :now/);
  assert.match(meta.ConditionExpression!, /attribute_not_exists/);
  assert.equal(meta.ExpressionAttributeValues![':now'], at.getTime());
  assert.equal(meta.ExpressionAttributeValues![':expected'], undefined); // no global-version CAS
  assert.equal(writes[1]!.Put!.ExpressionAttributeValues![':expected'], 0);
  const history = writes.filter(w => w.Put?.Item?.PK.startsWith('PICKHISTORY#'));
  assert.equal(history.length, 16);
  assert.ok(history.every(w => w.Put!.ConditionExpression === 'attribute_not_exists(PK)'));
});
test('clearing a draft deletes the old pick and audits deletion while retaining unrelated selections', () => {
  const { items, card } = records(); const snapshot = decodeContest(items);
  snapshot.cards.player = card;
  const next = { ...card, picks: card.picks.filter(p => p.slotId !== 'c1') };
  const writes = buildCardTransaction('table', snapshot, { contestId: 'week', participantId: 'player', expectedCardRevision: 0, card: next }, at);
  assert.equal(writes.filter(w => w.Delete).length, 1);
  assert.deepEqual(writes.find(w => w.Delete)!.Delete!.Key, keys.pick('week','player','c1'));
  assert.equal(writes.find(w => w.Put?.Item?.SK.includes('#c1#'))!.Put!.Item!.data.after, null);
});
test('reordered selections do not generate spurious per-slot revisions', () => {
  const { items, card } = records(); const snapshot = decodeContest(items); snapshot.cards.player = card;
  const writes = buildCardTransaction('table', snapshot, { contestId: 'week', participantId: 'player', expectedCardRevision: 0, card: { ...card, picks: [...card.picks].reverse() } }, at);
  assert.equal(writes.length, 3); // metadata, participant, card-level audit
});
test('Submit uses persisted card, validates completion and records status without trusting supplied picks', () => {
  const { items, card } = records(); const snapshot = decodeContest(items);
  assert.throws(() => buildCardTransaction('table', snapshot, { contestId: 'week', participantId: 'player', expectedCardRevision: 0, submit: true, card }, at), /INVALID_CARD/);
  snapshot.cards.player = card;
  const writes = buildCardTransaction('table', snapshot, { contestId: 'week', participantId: 'player', expectedCardRevision: 0, submit: true }, at);
  assert.equal(writes[1]!.Put!.Item!.data.submissionStatus, 'SUBMITTED');
  assert.equal(writes[1]!.Put!.Item!.data.cardRevision, 1);
});
test('snapshot follows every query page and requests strong reads without scans or indexes', async () => {
  const { items } = records(); const queries: any[] = [];
  const repo = new DynamoContestRepository(client(async command => {
    if (command instanceof GetCommand) { assert.equal(command.input.ConsistentRead, true); return { Item: items[0] }; }
    assert.ok(command instanceof QueryCommand); queries.push(command.input);
    return queries.length === 1 ? { Items: items.slice(0,10), LastEvaluatedKey: { PK: 'CONTEST#week', SK: 'cursor' } } : { Items: items.slice(10) };
  }), 'table', () => at);
  assert.equal((await repo.getSnapshot('week')).configuration.slots.length, 15);
  assert.equal(queries.length, 2); assert.equal(queries[1].ExclusiveStartKey.SK, 'cursor');
  assert.ok(queries.every(q => q.ConsistentRead && !q.IndexName));
});
test('snapshot retries if version changes across query pages', async () => {
  const { items } = records(); let reads = 0; let queries = 0;
  const repo = new DynamoContestRepository(client(async command => {
    if (command instanceof GetCommand) { reads++; return { Item: { ...items[0], data: { ...contest, version: reads === 1 ? 1 : 2 } } }; }
    queries++; return { Items: items.map(i => i.SK === 'META' ? { ...i, data: { ...contest, version: 2 } } : i) };
  }), 'table', () => at);
  assert.equal((await repo.getSnapshot('week')).contest.version, 2); assert.equal(queries, 2);
});
test('conditional participant failure returns latest own card, not other participants data', async () => {
  const { items, card } = records(); let failed = false;
  const repo = new DynamoContestRepository(client(async command => {
    if (command instanceof TransactWriteCommand) { failed = true; throw { name: 'TransactionCanceledException', CancellationReasons: [{Code:'None'},{Code:'ConditionalCheckFailed'}] }; }
    if (command instanceof GetCommand) return { Item: items[0] };
    return { Items: items.map(i => failed && i.SK === 'PARTICIPANT#player' ? { ...i, data: { ...participant, cardRevision: 1 } } : i) };
  }), 'table', () => at);
  await assert.rejects(repo.savePickCard({ contestId:'week', participantId:'player', expectedCardRevision:0, card }), (e: unknown) => e instanceof RepositoryError && e.code === 'CARD_REVISION_CONFLICT' && (e.canonical as any).participant.cardRevision === 1 && !(e.canonical as any).participants);
});
test('transaction lock failures and storage contention remain distinct', async () => {
  const { items, card } = records();
  for (const [reason, code] of [['ConditionalCheckFailed','LOCKED'],['TransactionConflict','TRANSACTION_RETRY_REQUIRED']]) {
    const repo = new DynamoContestRepository(client(async command => {
      if (command instanceof TransactWriteCommand) throw { name:'TransactionCanceledException', CancellationReasons:[{Code:reason}] };
      if (command instanceof GetCommand) return { Item: items[0] }; return { Items: items };
    }), 'table', () => at);
    await assert.rejects(repo.savePickCard({ contestId:'week', participantId:'player', expectedCardRevision:0, card }), (e: unknown) => e instanceof RepositoryError && e.code === code);
  }
});
test('lock reached while loading snapshot prevents any write submission', async () => {
  const { items, card } = records(); let writes = 0;
  const repo = new DynamoContestRepository(client(async command => {
    if (command instanceof TransactWriteCommand) { writes++; return {}; }
    if (command instanceof GetCommand) return { Item: items[0] }; return { Items: items };
  }), 'table', () => new Date(contest.lockAt));
  await assert.rejects(repo.savePickCard({contestId:'week',participantId:'player',expectedCardRevision:0,card}), /LOCKED/); assert.equal(writes,0);
});
test('session resolution checks expiry, contest scope and active participant even before TTL cleanup', async () => {
  for (const [expiresAt, contestId, status, allowed] of [[at.getTime()-1,'week','ACTIVE',false],[at.getTime()+1000,'other','ACTIVE',false],[at.getTime()+1000,'week','NOT_PLAYING',false],[at.getTime()+1000,'week','ACTIVE',true]] as const) {
    const repo = new DynamoContestRepository(client(async command => ({ Item: command.input.Key.PK.startsWith('SESSION#') ? { data:{contestId,participantId:'player',expiresAt} } : { data:{status} } })), 'table', () => at);
    assert.equal(!!await repo.resolveSession('secret','week'), allowed);
  }
});
