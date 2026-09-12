import { RepositoryError, assertOpen, verifyJoinSecret, type Repository, type CardWrite } from './repository.js';
import { createHash, randomUUID } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, QueryCommand, TransactWriteCommand, DeleteCommand,
  type TransactWriteCommandInput } from '@aws-sdk/lib-dynamodb';
import { changeDay, freezeConfiguration, prepareCardSave, type Contest, type ContestConfiguration, type ContestParticipant, type PickCard, type Selection } from '../../domain/src/index.js';
import type { StoredContest, ParticipantSession, JoinRequest } from './store.js';

export interface Key { PK: string; SK: string }
const part = (id: string) => { if (!id || id.length > 200 || id.includes('#')) throw new Error('Invalid key identifier'); return id; };
export const keys = {
  contest: (id: string): Key => ({ PK: `CONTEST#${part(id)}`, SK: 'META' }),
  join: (id: string, requestId: string): Key => ({ PK: `CONTEST#${part(id)}`, SK: `JOIN#${part(requestId)}` }),
  participant: (id: string, participant: string): Key => ({ PK: `CONTEST#${part(id)}`, SK: `PARTICIPANT#${part(participant)}` }),
  pick: (id: string, participant: string, slot: string): Key => ({ PK: `CONTEST#${part(id)}`, SK: `PICK#${part(participant)}#${part(slot)}` }),
  history: (id: string, participant: string, slot: string, at: string, revision: string): Key => ({ PK: `PICKHISTORY#${part(id)}#${part(participant)}`, SK: `${part(at)}#${part(slot)}#${part(revision)}` }),
  session: (rawToken: string): Key => ({ PK: `SESSION#${createHash('sha256').update(rawToken).digest('hex')}`, SK: 'META' }),
};
interface Item extends Key { data: any; [key: string]: any }
type Action = NonNullable<TransactWriteCommandInput['TransactItems']>[number];
export { RepositoryError } from './repository.js';
const own = <T>(map: Record<string, T>, key: string): T | undefined => Object.hasOwn(map, key) ? map[key] : undefined;
export function encodeContest(contest: Contest, config: ContestConfiguration): Item[] {
  freezeConfiguration(config);
  if (config.contestId !== contest.id || contest.phase !== 'PREGAME' || contest.version !== 1 || contest.lockedAt || !Number.isFinite(Date.parse(contest.lockAt))) throw new Error('Invalid new contest');
  const PK = keys.contest(contest.id).PK;
  return [
    { ...keys.contest(contest.id), data: { ...contest, lockAt: new Date(contest.lockAt).toISOString() }, lockAtMs: Date.parse(contest.lockAt), mainEventGameId: config.mainEventGameId, pendingJoins: 0 },
    ...config.games.map(data => ({ PK, SK: `GAME#${part(data.id)}`, data })),
    ...config.propositions.map(data => ({ PK, SK: `PROP#${part(data.id)}`, data })),
    ...config.slots.map(data => ({ PK, SK: `SLOT#${part(data.id)}`, data })),
  ];
}
export function decodeContest(items: Item[]): StoredContest {
  const meta = items.find(i => i.SK === 'META');
  if (!meta) throw new RepositoryError('NOT_FOUND');
  const config: ContestConfiguration = { contestId: meta.data.id, mainEventGameId: meta.mainEventGameId,
    games: items.filter(i => i.SK.startsWith('GAME#')).map(i => i.data),
    propositions: items.filter(i => i.SK.startsWith('PROP#')).map(i => i.data),
    slots: items.filter(i => i.SK.startsWith('SLOT#')).map(i => i.data).sort((a,b) => a.order-b.order) };
  freezeConfiguration(config);
  const participants: StoredContest['participants'] = Object.create(null);
  const cards: StoredContest['cards'] = Object.create(null);
  for (const item of items.filter(i => i.SK.startsWith('PARTICIPANT#'))) {
    const { prediction, ...p } = item.data;
    participants[p.participantId] = p; cards[p.participantId] = { picks: [], ...(prediction === undefined ? {} : { prediction }) };
  }
  for (const item of items.filter(i => i.SK.startsWith('PICK#'))) {
    const [_, participantId] = item.SK.split('#');
    const card = own(cards, participantId!);
    if (!card) throw new Error('Orphan persisted pick');
    card.picks.push(item.data);
  }
  return { contest: meta.data, configuration: config, participants, cards, ...(meta.gameDay ? {gameDay:meta.gameDay} : {}) };
}
const protect = (table: string, key: Key, now: number): Action => ({ Update: {
  TableName: table, Key: key, UpdateExpression: 'SET #d.#v = #d.#v + :one',
  ConditionExpression: 'attribute_exists(PK) AND #d.#phase = :pregame AND attribute_not_exists(#d.#locked) AND lockAtMs > :now',
  ExpressionAttributeNames: { '#d': 'data', '#v': 'version', '#phase': 'phase', '#locked': 'lockedAt' },
  ExpressionAttributeValues: { ':one': 1, ':pregame': 'PREGAME', ':now': now },
} });
function guardTransaction(items: Action[]): void {
  if (!items.length || items.length > 100) throw new Error('Transaction exceeds 100 actions');
  const unique = new Set<string>();
  for (const action of items) {
    const op = action.Put ?? action.Update ?? action.Delete ?? action.ConditionCheck!;
    const key = 'Item' in op ? op.Item! : op.Key!;
    const id = `${key.PK}|${key.SK}`;
    if (unique.has(id)) throw new Error('Duplicate transaction target'); unique.add(id);
  }
}
export type { CardWrite } from './repository.js';
export function buildCardTransaction(table: string, snapshot: StoredContest, input: CardWrite, at: Date): Action[] {
  const p = own(snapshot.participants, input.participantId);
  if (!p || input.contestId !== snapshot.contest.id) throw new RepositoryError('FORBIDDEN');
  const before = snapshot.cards[input.participantId]!;
  const saved = prepareCardSave(snapshot.configuration, snapshot.contest, p, input.submit ? before : input.card, input.expectedCardRevision, at.toISOString(), input.submit);
  const nextParticipant = { ...p, cardRevision: p.cardRevision + 1, submissionStatus: saved.submissionStatus,
    lastEditedBy: 'PARTICIPANT', lastEditedAt: at.toISOString(), ...(input.submit ? { submittedAt: at.toISOString() } : {}),
    ...(saved.card.prediction === undefined ? {} : { prediction: saved.card.prediction }) };
  const actions: Action[] = [protect(table, keys.contest(input.contestId), at.getTime()), { Put: {
    TableName: table, Item: { ...keys.participant(input.contestId, p.participantId), data: nextParticipant },
    ConditionExpression: '#d.#revision = :expected AND #d.#status = :active',
    ExpressionAttributeNames: { '#d': 'data', '#revision': 'cardRevision', '#status': 'status' },
    ExpressionAttributeValues: { ':expected': input.expectedCardRevision, ':active': 'ACTIVE' },
  } }];
  const revision = String(p.cardRevision + 1);
  for (const slot of snapshot.configuration.slots) {
    const previous = before.picks.find(p => p.slotId === slot.id);
    const next = saved.card.picks.find(p => p.slotId === slot.id);
    if (sameSelection(previous, next)) continue;
    const key = keys.pick(input.contestId, p.participantId, slot.id);
    actions.push(next ? { Put: { TableName: table, Item: { ...key, data: next } } } : { Delete: { TableName: table, Key: key } });
    actions.push({ Put: { TableName: table, Item: { ...keys.history(input.contestId, p.participantId, slot.id, at.toISOString(), revision), data: { before: previous ?? null, after: next ?? null, editedBy: 'PARTICIPANT' } }, ConditionExpression: 'attribute_not_exists(PK)' } });
  }
  // The tiebreak and explicit submission are audited outside the current contest partition too.
  actions.push({ Put: { TableName: table, Item: { PK: keys.history(input.contestId, p.participantId, '_CARD', at.toISOString(), revision).PK, SK: `CARD#${at.toISOString()}#${revision}`, data: { beforePrediction: before.prediction ?? null, afterPrediction: saved.card.prediction ?? null, submitted: !!input.submit } }, ConditionExpression: 'attribute_not_exists(PK)' } });
  guardTransaction(actions); return actions;
}
function sameSelection(a?: Selection, b?: Selection): boolean { return a?.slotId === b?.slotId && a?.choiceId === b?.choiceId && a?.confidence === b?.confidence; }
export class DynamoContestRepository implements Repository {
  constructor(private readonly client: Pick<DynamoDBDocumentClient, 'send'>, private readonly table: string, private readonly now: () => Date = () => new Date()) {
    if (!table) throw new Error('DynamoDB table required');
  }
  private async get(key: Key): Promise<Item | undefined> {
    return (await this.client.send(new GetCommand({ TableName: this.table, Key: key, ConsistentRead: true }))).Item as Item | undefined;
  }
  async createContest(contest: Contest, config: ContestConfiguration): Promise<void> {
    if (Date.parse(contest.lockAt) <= this.now().getTime()) throw new RepositoryError('LOCKED');
    const items = encodeContest(contest, config);
    const actions = items.map(Item => ({ Put: { TableName: this.table, Item, ConditionExpression: 'attribute_not_exists(PK)' } }));
    guardTransaction(actions);
    try { await this.client.send(new TransactWriteCommand({ TransactItems: actions, ClientRequestToken: randomUUID() })); }
    catch (error) {
      const e = error as { name?: string; CancellationReasons?: { Code?: string }[] };
      if (e.name === 'TransactionCanceledException' && e.CancellationReasons?.some(r => r.Code === 'ConditionalCheckFailed')) throw new RepositoryError('CONTEST_EXISTS');
      throw error;
    }
  }
  async getSnapshot(id: string): Promise<StoredContest> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const key = keys.contest(id); const before = await this.get(key);
      if (!before) throw new RepositoryError('NOT_FOUND');
      const items: Item[] = []; let cursor: Record<string, any> | undefined;
      do {
        const page = await this.client.send(new QueryCommand({ TableName: this.table, KeyConditionExpression: 'PK = :pk', ExpressionAttributeValues: { ':pk': key.PK }, ConsistentRead: true, ...(cursor ? { ExclusiveStartKey: cursor } : {}) }));
        items.push(...(page.Items ?? []) as Item[]); cursor = page.LastEvaluatedKey;
      } while (cursor && Object.keys(cursor).length);
      const after = await this.get(key);
      if (after?.data.version === before.data.version) return decodeContest(items);
    }
    throw new RepositoryError('SNAPSHOT_BUSY');
  }
  async updateDay(id: string, expectedVersion: number, action: string, body: Record<string,unknown>): Promise<StoredContest> {
    const c=await this.getSnapshot(id);
    if(c.contest.version!==expectedVersion) throw new RepositoryError('CONTEST_VERSION_CONFLICT');
    const at=this.now().toISOString(); changeDay(c,action,body,at); c.contest.version++;
    try {
      await this.client.send(new TransactWriteCommand({ClientRequestToken:randomUUID(),TransactItems:[
        {Update:{TableName:this.table,Key:keys.contest(id),UpdateExpression:'SET #d = :d, #day = :day',ConditionExpression:'#d.#v = :expected',ExpressionAttributeNames:{'#d':'data','#v':'version','#day':'gameDay'},ExpressionAttributeValues:{':d':c.contest,':day':c.gameDay,':expected':expectedVersion}}},
        ...(action==='provider'?[]:[{Put:{TableName:this.table,Item:{PK:keys.contest(id).PK,SK:`AUDIT#${c.contest.version}`,data:{at,action,body,actor:action==='lock'?'SERVER':'COMMISSIONER'}},ConditionExpression:'attribute_not_exists(PK)'}}]),
      ]}));
    } catch(error) {
      const e=error as {name?:string;CancellationReasons?:{Code?:string}[]};
      if(e.name==='TransactionCanceledException' && e.CancellationReasons?.some(r=>r.Code==='ConditionalCheckFailed')) throw new RepositoryError('CONTEST_VERSION_CONFLICT');
      throw error;
    }
    return c;
  }
  async addParticipant(participant: ContestParticipant): Promise<void> {
    if (participant.cardRevision !== 0 || participant.submissionStatus !== 'DRAFT' || participant.status !== 'ACTIVE') throw new Error('Invalid new participant');
    const at = this.now(); const p = structuredClone(participant);
    await this.client.send(new TransactWriteCommand({ ClientRequestToken: randomUUID(), TransactItems: [
      protect(this.table, keys.contest(p.contestId), at.getTime()),
      { Put: { TableName: this.table, Item: { ...keys.participant(p.contestId, p.participantId), data: p }, ConditionExpression: 'attribute_not_exists(PK)' } },
      { Update: { TableName: this.table, Key: { PK: `PLAYER#${part(p.playerId)}`, SK: 'PROFILE' }, UpdateExpression: 'SET #d = if_not_exists(#d, :profile)', ExpressionAttributeNames: { '#d': 'data' }, ExpressionAttributeValues: { ':profile': { id: p.playerId, name: p.displayName } } } },
    ] }));
  }
  async savePickCard(input: CardWrite): Promise<StoredContest> {
    const snapshot = await this.getSnapshot(input.contestId);
    let actions: Action[];
    try { actions = buildCardTransaction(this.table, snapshot, input, this.now()); }
    catch (error) {
      if ((error as Error).message === 'CARD_REVISION_CONFLICT') throw new RepositoryError('CARD_REVISION_CONFLICT', { participant: own(snapshot.participants, input.participantId), card: own(snapshot.cards, input.participantId) });
      throw error;
    }
    try { await this.client.send(new TransactWriteCommand({ ClientRequestToken: randomUUID(), TransactItems: actions })); }
    catch (error) {
      const e = error as { name?: string; CancellationReasons?: { Code?: string }[] };
      if (e.name === 'TransactionCanceledException') {
        if (e.CancellationReasons?.[0]?.Code === 'ConditionalCheckFailed') throw new RepositoryError('LOCKED');
        if (e.CancellationReasons?.[1]?.Code === 'ConditionalCheckFailed') {
          const latest = await this.getSnapshot(input.contestId);
          if (own(latest.participants, input.participantId)?.status !== 'ACTIVE') throw new RepositoryError('FORBIDDEN');
          throw new RepositoryError('CARD_REVISION_CONFLICT', { participant: own(latest.participants, input.participantId), card: own(latest.cards, input.participantId) });
        }
        // A storage contention/throttle error is not a participant revision conflict.
        throw new RepositoryError('TRANSACTION_RETRY_REQUIRED');
      }
      throw error;
    }
    return this.getSnapshot(input.contestId);
  }
  async listJoins(id: string): Promise<JoinRequest[]> {
    if (!await this.get(keys.contest(id))) throw new RepositoryError('NOT_FOUND');
    const joins: JoinRequest[] = []; let cursor: Record<string, any> | undefined;
    do {
      const page = await this.client.send(new QueryCommand({ TableName: this.table, KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)', ExpressionAttributeValues: { ':pk': keys.contest(id).PK, ':prefix': 'JOIN#' }, ConsistentRead: true, ...(cursor ? { ExclusiveStartKey: cursor } : {}) }));
      joins.push(...(page.Items ?? []).map(i => i.data as JoinRequest)); cursor = page.LastEvaluatedKey;
    } while (cursor && Object.keys(cursor).length);
    return joins;
  }
  async getJoin(id: string, requestId: string): Promise<JoinRequest> {
    const item = await this.get(keys.join(id, requestId));
    if (!item) throw new RepositoryError('NOT_FOUND'); return item.data;
  }
  private async joinWrite(actions: Action[], metaFailure = 'LOCKED'): Promise<void> {
    guardTransaction(actions);
    try { await this.client.send(new TransactWriteCommand({ ClientRequestToken: randomUUID(), TransactItems: actions })); }
    catch (error) {
      const e = error as { name?: string; CancellationReasons?: { Code?: string }[] };
      if (e.name !== 'TransactionCanceledException') throw error;
      if (e.CancellationReasons?.[0]?.Code === 'ConditionalCheckFailed') throw new RepositoryError(metaFailure);
      if (e.CancellationReasons?.[1]?.Code === 'ConditionalCheckFailed') throw new RepositoryError('JOIN_ALREADY_HANDLED');
      if (e.CancellationReasons?.[2]?.Code === 'ConditionalCheckFailed') throw new RepositoryError('FORBIDDEN');
      throw new RepositoryError('TRANSACTION_RETRY_REQUIRED');
    }
  }
  async createJoin(request: JoinRequest): Promise<void> {
    const meta = protect(this.table, keys.contest(request.contestId), this.now().getTime());
    const update = meta.Update!;
    update.UpdateExpression += ', #pending = if_not_exists(#pending, :zero) + :one';
    update.ConditionExpression += ' AND (attribute_not_exists(#pending) OR #pending < :limit)';
    update.ExpressionAttributeNames!['#pending'] = 'pendingJoins';
    Object.assign(update.ExpressionAttributeValues!, { ':zero': 0, ':limit': 100 });
    try { await this.joinWrite([meta, { Put: { TableName: this.table, Item: { ...keys.join(request.contestId, request.id), data: request }, ConditionExpression: 'attribute_not_exists(PK)' } }], 'JOIN_LIMIT_OR_LOCK'); }
    catch (e) {
      if (e instanceof RepositoryError && e.code === 'JOIN_LIMIT_OR_LOCK') {
        const c = await this.getSnapshot(request.contestId); assertOpen(c, this.now()); throw new RepositoryError('TOO_MANY_REQUESTS');
      }
      throw e;
    }
  }
  async decideJoin(id: string, requestId: string, p?: ContestParticipant): Promise<void> {
    const request = await this.getJoin(id, requestId);
    if (request.status !== 'PENDING') throw new RepositoryError('JOIN_ALREADY_HANDLED');
    if (p && (p.contestId !== id || p.displayName !== request.name || p.status !== 'ACTIVE' || p.cardRevision !== 0 || p.submissionStatus !== 'DRAFT')) throw new RepositoryError('FORBIDDEN');
    const meta = protect(this.table, keys.contest(id), this.now().getTime());
    meta.Update!.UpdateExpression += ', #pending = #pending - :one';
    meta.Update!.ExpressionAttributeNames!['#pending'] = 'pendingJoins';
    const actions: Action[] = [meta, { Put: { TableName: this.table, Item: { ...keys.join(id, requestId), data: { ...request, status: p ? 'APPROVED' : 'DENIED', ...(p ? { participantId: p.participantId } : {}) } }, ConditionExpression: '#d.#s = :pending', ExpressionAttributeNames: { '#d': 'data', '#s': 'status' }, ExpressionAttributeValues: { ':pending': 'PENDING' } } }];
    if (p) actions.push(
      { Put: { TableName: this.table, Item: { ...keys.participant(id, p.participantId), data: p }, ConditionExpression: 'attribute_not_exists(PK)' } },
      { Put: { TableName: this.table, Item: { PK: `PLAYER#${part(p.playerId)}`, SK: 'PROFILE', data: { id: p.playerId, name: p.displayName } }, ConditionExpression: 'attribute_not_exists(PK)' } },
    );
    await this.joinWrite(actions);
  }
  async exchangeJoin(id: string, requestId: string, secret: string, token: string, session: ParticipantSession): Promise<void> {
    const request = await this.getJoin(id, requestId); verifyJoinSecret(secret, request.secretHash);
    if (request.status !== 'APPROVED') throw new RepositoryError('JOIN_ALREADY_HANDLED');
    if (session.contestId !== id || session.participantId !== request.participantId || session.expiresAt <= this.now().getTime()) throw new RepositoryError('FORBIDDEN');
    await this.joinWrite([
      protect(this.table, keys.contest(id), this.now().getTime()),
      { Put: { TableName: this.table, Item: { ...keys.join(id, requestId), data: { ...request, status: 'EXCHANGED' } }, ConditionExpression: '#d.#s = :approved AND #d.#hash = :hash AND #d.#p = :p', ExpressionAttributeNames: { '#d': 'data', '#s': 'status', '#hash': 'secretHash', '#p': 'participantId' }, ExpressionAttributeValues: { ':approved': 'APPROVED', ':hash': request.secretHash, ':p': session.participantId } } },
      { ConditionCheck: { TableName: this.table, Key: keys.participant(id, session.participantId), ConditionExpression: '#d.#s = :active', ExpressionAttributeNames: { '#d': 'data', '#s': 'status' }, ExpressionAttributeValues: { ':active': 'ACTIVE' } } },
      { Put: { TableName: this.table, Item: { ...keys.session(token), data: session, expiresAt: Math.floor(session.expiresAt / 1000) }, ConditionExpression: 'attribute_not_exists(PK)' } },
    ]);
  }
  async resolveSession(rawToken: string, contestId: string): Promise<ParticipantSession | undefined> {
    if (!rawToken) return undefined;
    const item = await this.get(keys.session(rawToken)); const session = item?.data as ParticipantSession | undefined;
    if (!session || session.expiresAt <= this.now().getTime()) return undefined;
    if (session.contestId !== contestId) throw new RepositoryError('FORBIDDEN');
    const p = await this.get(keys.participant(contestId, session.participantId));
    if (p?.data.status !== 'ACTIVE') throw new RepositoryError('FORBIDDEN');
    return session;
  }
  async revokeSession(rawToken: string): Promise<void> {
    await this.client.send(new DeleteCommand({ TableName: this.table, Key: keys.session(rawToken) }));
  }
}
export function createDynamoRepository(table: string, region?: string): DynamoContestRepository {
  const client = DynamoDBDocumentClient.from(new DynamoDBClient({ ...(region ? { region } : {}) }), { marshallOptions: { removeUndefinedValues: true } });
  return new DynamoContestRepository(client, table);
}
