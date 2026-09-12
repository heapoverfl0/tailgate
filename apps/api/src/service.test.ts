import { StoreRepository } from '../../../packages/persistence/src/repository.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileStore, MemoryStore, type StoreState } from '../../../packages/persistence/src/store.js';
import { fixture } from '../../../packages/domain/src/fixture.js';
import { createService, type ApiResponse, type ApiRequest } from './service.js';
const origin = 'https://tailgate.test';
const settings = { origin, password: 'test-only-password', signingSecret: 'test-only-signing-secret-at-least-32-characters', secureCookies: true };
const value = (r: ApiResponse) => r.body as any;
const cookie = (r: ApiResponse) => r.cookies?.[0]?.split(';')[0] ?? '';
async function setup(store = new MemoryStore()) {
  let time = new Date('2026-09-12T15:00:00Z');
  const api = createService(new StoreRepository(store, () => time), { ...settings, now: () => time });
  const call = (method: string, path: string, body?: unknown, session = '') => api({ method, path, body, headers: { origin, cookie: session } });
  const admin = cookie(await call('POST', '/api/commissioner/login', { password: settings.password }));
  const { c, card } = fixture();
  const created = await call('POST', '/api/contests', { contest: { id: 'week', name: 'Week', timezone: 'America/Chicago', lockAt: '2026-09-12T16:00:00Z' }, configuration: c }, admin);
  assert.equal(created.statusCode, 201);
  const joinPlayer = async (name = 'Player') => {
    const request = value(await call('POST', '/api/contests/week/join-requests', { displayName: name }));
    const approved = await call('POST', `/api/contests/week/join-requests/${request.requestId}/approve`, { attendance: 'REMOTE' }, admin);
    assert.equal(approved.statusCode, 200); assert.equal(approved.cookies, undefined);
    const exchanged = await call('POST', `/api/contests/week/join-requests/${request.requestId}`, { requestSecret: request.requestSecret });
    assert.equal(exchanged.statusCode, 200);
    return { session: cookie(exchanged), request, exchanged };
  };
  return { api, call, admin, card, c, joinPlayer, store, advance: () => { time = new Date('2026-09-12T16:00:00Z'); } };
}
test('login rejects wrong credentials, cross-origin writes and tampered admin cookies', async () => {
  const { call, api, admin } = await setup();
  assert.equal((await call('POST', '/api/commissioner/login', { password: 'bad' })).statusCode, 401);
  assert.equal((await api({ method: 'POST', path: '/api/commissioner/login', body: { password: settings.password }, headers: { origin: 'https://evil.test' } })).statusCode, 403);
  assert.equal((await call('POST', '/api/contests', {}, admin + 'x')).statusCode, 401);
});
test('join approval issues participant token only to request-secret holder and stores only hashes', async () => {
  const s = await setup(); const player = await s.joinPlayer();
  assert.match(player.exchanged.cookies![0]!, /HttpOnly; SameSite=Lax/); assert.match(player.exchanged.cookies![0]!, /Secure/);
  const persisted = JSON.stringify(await s.store.read());
  assert.equal(persisted.includes(player.request.requestSecret), false);
  assert.equal(persisted.includes(player.session.split('=')[1]!), false);
  const path = `/api/contests/week/join-requests/${player.request.requestId}`;
  assert.equal((await s.call('POST', path, { requestSecret: 'wrong' })).statusCode, 401);
  assert.equal((await s.call('POST', path, { requestSecret: player.request.requestSecret })).statusCode, 401);
  const retry = await s.call('POST', path, { requestSecret: player.request.requestSecret }, player.session);
  assert.equal(retry.statusCode, 200); assert.equal(retry.cookies, undefined);
});
test('save, explicit Submit and revision conflict return canonical own card', async () => {
  const s = await setup(); const { session } = await s.joinPlayer();
  const saved = await s.call('PUT', '/api/contests/week/me/pick-card', { ...s.card, expectedCardRevision: 0 }, session);
  assert.equal(saved.statusCode, 200); assert.equal(value(saved).cardRevision, 1); assert.equal(value(saved).submissionStatus, 'DRAFT');
  const stale = await s.call('PUT', '/api/contests/week/me/pick-card', { picks: [], expectedCardRevision: 0 }, session);
  assert.equal(stale.statusCode, 409); assert.equal(value(stale).error.details.cardRevision, 1);
  const submitted = await s.call('POST', '/api/contests/week/me/submit', { expectedCardRevision: 1 }, session);
  assert.equal(submitted.statusCode, 200); assert.equal(value(submitted).submissionStatus, 'SUBMITTED');
  assert.equal((await s.call('PUT', '/api/contests/week/me/pick-card', { picks: [], expectedCardRevision: 2 }, session)).statusCode, 422);
});
test('public and commissioner pregame views cannot expose other participants cards or history', async () => {
  const s = await setup(); const a = await s.joinPlayer('A'); const b = await s.joinPlayer('B');
  await s.call('PUT', '/api/contests/week/me/pick-card', { ...s.card, expectedCardRevision: 0 }, a.session);
  for (const session of ['', s.admin, b.session]) {
    const view = value(await s.call('GET', '/api/contests/week/pregame', undefined, session));
    assert.equal(view.cards, undefined); assert.equal(view.history, undefined);
    assert.equal(view.participants[0].picks, undefined); assert.equal(view.participants[0].prediction, undefined);
    assert.equal(view.participants[0].completedSelections, 15);
  }
  assert.equal((await s.call('GET', '/api/contests/week/me/pick-card', undefined, s.admin)).statusCode, 401);
  assert.deepEqual(value(await s.call('GET', '/api/contests/week/me/pick-card', undefined, b.session)).picks, []);
});
test('simultaneous writes with the same revision have one winner and one audit record', async () => {
  const s = await setup(); const { session } = await s.joinPlayer();
  const requests = await Promise.all([1,2].map(() => s.call('PUT', '/api/contests/week/me/pick-card', { ...s.card, expectedCardRevision: 0 }, session)));
  assert.deepEqual(requests.map(r => r.statusCode).sort(), [200,409]);
  assert.equal((await s.store.read()).history.length, 1);
});
test('different participants do not conflict through global contest version', async () => {
  const s = await setup(); const a = await s.joinPlayer('A'); const b = await s.joinPlayer('B');
  const responses = await Promise.all([a,b].map(p => s.call('PUT', '/api/contests/week/me/pick-card', { ...s.card, expectedCardRevision: 0 }, p.session)));
  assert.deepEqual(responses.map(r => r.statusCode), [200,200]);
});
test('inclusive lock blocks saves, Submit and joins but preserves own-card reads', async () => {
  const s = await setup(); const { session } = await s.joinPlayer(); s.advance();
  assert.equal((await s.call('PUT', '/api/contests/week/me/pick-card', { ...s.card, expectedCardRevision: 0 }, session)).statusCode, 409);
  assert.equal((await s.call('POST', '/api/contests/week/me/submit', { expectedCardRevision: 0 }, session)).statusCode, 409);
  assert.equal((await s.call('POST', '/api/contests/week/join-requests', { displayName: 'Late' })).statusCode, 409);
  assert.equal((await s.call('GET', '/api/contests/week/me/pick-card', undefined, session)).statusCode, 200);
});
test('file repository survives restart with participant sessions, cards and revisions', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'tailgate-store-'));
  try {
    const path = join(directory, 'state.json'); const s = await setup(await FileStore.open(path)); const { session } = await s.joinPlayer();
    await s.call('PUT', '/api/contests/week/me/pick-card', { ...s.card, expectedCardRevision: 0 }, session);
    const reloaded = await FileStore.open(path); const api = createService(new StoreRepository(reloaded), { ...settings, now: () => new Date('2026-09-12T15:30:00Z') });
    const result = await api({ method: 'GET', path: '/api/contests/week/me/pick-card', headers: { cookie: session } });
    assert.equal(result.statusCode, 200); assert.equal(value(result).cardRevision, 1);
    assert.equal((await reloaded.read()).history.length, 1);
    assert.equal((await readFile(path, 'utf8')).includes(session.split('=')[1]!), false);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
test('failed repository persistence does not publish in-memory state and later transactions still work', async () => {
  class FailingStore extends MemoryStore { fail = true; protected override async persist(_next: StoreState) { if (this.fail) throw new Error('disk unavailable'); } }
  const store = new FailingStore();
  await assert.rejects(store.transact(s => { s.history.push({} as any); }), /disk unavailable/);
  assert.equal((await store.read()).history.length, 0);
  store.fail = false; await store.transact(s => { s.history.push({} as any); });
  assert.equal((await store.read()).history.length, 1);
});

test('commissioner can list and deny pending requests without exposing request secrets', async () => {
  const s = await setup(); const request = value(await s.call('POST', '/api/contests/week/join-requests', { displayName: 'Waiting' }));
  assert.equal((await s.call('GET', '/api/contests/week/join-requests')).statusCode, 401);
  const list = value(await s.call('GET', '/api/contests/week/join-requests', undefined, s.admin));
  assert.deepEqual(list.requests, [{ requestId: request.requestId, displayName: 'Waiting', status: 'PENDING' }]);
  assert.equal((await s.call('POST', `/api/contests/week/join-requests/${request.requestId}/deny`, {}, s.admin)).statusCode, 200);
  assert.equal(value(await s.call('POST', `/api/contests/week/join-requests/${request.requestId}`, { requestSecret: request.requestSecret })).status, 'DENIED');
});
test('configuration rejects unknown fields and cross-contest participant sessions', async () => {
  const s = await setup(); const { session } = await s.joinPlayer();
  assert.equal((await s.call('GET', '/api/contests/other/me/pick-card', undefined, session)).statusCode, 403);
  const response = await s.call('POST', '/api/contests', { contest: { id: 'other', name: 'Other', timezone: 'UTC', lockAt: '2026-09-12T18:00:00Z' }, configuration: { ...s.c, hiddenPicks: [] } }, s.admin);
  assert.equal(response.statusCode, 422);
});

test('concurrent approval and exchange each commit once without issuing two sessions', async () => {
  const s = await setup();
  const request = value(await s.call('POST', '/api/contests/week/join-requests', { displayName: 'Racing' }));
  const path = `/api/contests/week/join-requests/${request.requestId}`;
  const approvals = await Promise.all([1,2].map(() => s.call('POST', `${path}/approve`, { attendance: 'ON_SITE' }, s.admin)));
  assert.deepEqual(approvals.map(r => r.statusCode).sort(), [200,409]);
  const exchanges = await Promise.all([1,2].map(() => s.call('POST', path, { requestSecret: request.requestSecret })));
  assert.equal(exchanges.filter(r => r.cookies?.length).length, 1);
  assert.ok(exchanges.every(r => [200,401,409].includes(r.statusCode)));
  const persisted = await s.store.read();
  assert.equal(Object.keys(persisted.contests.week!.participants).length, 1);
  assert.equal(Object.keys(persisted.sessions).length, 1);
});
test('pending request cap and lock prevent approval and session issuance', async () => {
  const s = await setup();
  const request = value(await s.call('POST', '/api/contests/week/join-requests', { displayName: 'Waiting' }));
  for (let i = 1; i < 100; i++) assert.equal((await s.call('POST', '/api/contests/week/join-requests', { displayName: 'Waiting' })).statusCode, 201);
  assert.equal((await s.call('POST', '/api/contests/week/join-requests', { displayName: 'Over limit' })).statusCode, 429);
  s.advance();
  assert.equal((await s.call('POST', `/api/contests/week/join-requests/${request.requestId}/approve`, { attendance: 'REMOTE' }, s.admin)).statusCode, 409);
  assert.equal((await s.call('POST', `/api/contests/week/join-requests/${request.requestId}`, { requestSecret: request.requestSecret })).statusCode, 409);
});

test('simultaneous edits allow one winner and preserve canonical card', async()=>{
 const s=await setup();const p=await s.joinPlayer();
 const responses=await Promise.all([s.call('PUT','/api/contests/week/me/pick-card',{...s.card,expectedCardRevision:0},p.session),s.call('PUT','/api/contests/week/me/pick-card',{picks:[],expectedCardRevision:0},p.session)]);
 assert.deepEqual(responses.map(r=>r.statusCode).sort(),[200,409]);
 assert.equal(value(responses.find(r=>r.statusCode===409)!).error.details.cardRevision,1);
});
test('deadline locks atomically; reveal embargo, audited results, correction and final history',async()=>{
 const s=await setup();const p=await s.joinPlayer('A');
 await s.call('PUT','/api/contests/week/me/pick-card',{...s.card,expectedCardRevision:0},p.session);
 const base='/api/contests/week/game-day';
 assert.equal(value(await s.call('GET',base)).board,undefined);
 s.advance();
 assert.equal((await s.call('PUT','/api/contests/week/me/pick-card',{...s.card,expectedCardRevision:1},p.session)).statusCode,409);
 let view=value(await s.call('GET',base));assert.equal(view.contest.phase,'REVEAL');assert.deepEqual(view.reveal.groups,[]);assert.equal(view.board,undefined);
 assert.equal((await s.call('POST',base+'/advance',{expectedVersion:view.contest.version})).statusCode,401);
 assert.equal((await s.call('POST',base+'/advance',{expectedVersion:0},s.admin)).statusCode,409);
 for(let step=1;step<=6;step++) {
  assert.equal((await s.call('POST',base+'/advance',{expectedVersion:view.contest.version},s.admin)).statusCode,200);
  view=value(await s.call('GET',base));
  if(step<6){assert.equal(view.board,undefined);if(step<5)assert.ok(view.reveal.groups.every((g:any)=>!['winner','first','play','half','total'].includes(g.slotId)));}
 }
 assert.equal(view.contest.phase,'LIVE');assert.equal(view.board.entries[0].picks.length,15);
 const result=async(gameId:string,fact:unknown)=>{
  view=value(await s.call('GET',base));return s.call('POST',base+'/result',{expectedVersion:view.contest.version,gameId,fact,reason:'Synthetic test observation'},s.admin);
 };
 assert.equal((await result('g1',{status:'FINAL',home:7,away:10,firstTeam:'wrong'})).statusCode,422);
 for(const g of s.c.games) assert.equal((await result(g.id,{status:'FINAL',home:31,away:27,...(g.id==='main'?{firstTeam:'main-home',firstScore:'TOUCHDOWN',halftime:'TIE'}:{})})).statusCode,200);
 view=value(await s.call('GET',base)); const points=view.board.entries[0].points;
 assert.equal((await result('g1',{status:'FINAL',home:7,away:10})).statusCode,200);
 view=value(await s.call('GET',base));assert.notEqual(view.board.entries[0].points,points);
 assert.equal((await s.call('POST',base+'/finalize',{expectedVersion:view.contest.version},s.admin)).statusCode,200);
 view=value(await s.call('GET',base));assert.equal(view.contest.phase,'FINAL');assert.equal(view.board.champions.length,1);
 const stored=(await s.store.read()).contests.week!;assert.ok(stored.gameDay?.final);assert.ok(stored.dayAudit!.length>=15);
 assert.equal((await result('g1',{status:'VOID'})).statusCode,422);
});

test('commissioner cannot inject provider state through the public API',async()=>{const s=await setup();s.advance();assert.equal((await s.call('POST','/api/contests/week/game-day/provider',{expectedVersion:1,games:{}},s.admin)).statusCode,422);});


test('recovery restores the existing card, revokes older sessions, and is one-use',async()=>{
 const s=await setup();const player=await s.joinPlayer();const base='/api/contests/week';
 await s.call('PUT',base+'/me/pick-card',{...s.card,expectedCardRevision:0},player.session);
 const before=value(await s.call('GET',base+'/me/pick-card',undefined,player.session));
 const pid=Object.keys((await s.store.read()).contests.week!.participants)[0]!;
 assert.equal((await s.call('POST',base+'/recovery-code',{participantId:pid},player.session)).statusCode,401);
 const issued=await s.call('POST',base+'/recovery-code',{participantId:pid},s.admin);assert.equal(issued.statusCode,201);
 const code=value(issued).code;assert.equal(JSON.stringify(await s.store.read()).includes(code.split('.')[1]),false);
 assert.equal((await s.call('POST',base+'/recover',{code:pid+'.'+'x'.repeat(43)})).statusCode,401);
 const recovered=await s.call('POST',base+'/recover',{code});assert.equal(recovered.statusCode,200);
 const fresh=cookie(recovered);assert.match(recovered.cookies![0]!,/HttpOnly/);
 const after=value(await s.call('GET',base+'/me/pick-card',undefined,fresh));
 assert.deepEqual(after.picks,before.picks);assert.deepEqual(after.prediction,before.prediction);assert.equal(after.cardRevision,before.cardRevision);
 assert.equal((await s.call('GET',base+'/me/pick-card',undefined,player.session)).statusCode,401);
 assert.equal((await s.call('POST',base+'/recover',{code})).statusCode,401);
 assert.equal((await s.call('PUT',base+'/me/pick-card',{...s.card,expectedCardRevision:1},fresh)).statusCode,200);
 assert.equal(Object.keys((await s.store.read()).contests.week!.participants).length,1);
});
test('recovery expiry, replacement, concurrent redemption, and post-lock access preserve the lock',async()=>{
 const s=await setup();const player=await s.joinPlayer();const base='/api/contests/week';
 const pid=Object.keys((await s.store.read()).contests.week!.participants)[0]!;
 const issue=async()=>value(await s.call('POST',base+'/recovery-code',{participantId:pid},s.admin)).code;
 const expired=await issue();s.advance();assert.equal((await s.call('POST',base+'/recover',{code:expired})).statusCode,401);
 const replaced=await issue();const code=await issue();assert.equal((await s.call('POST',base+'/recover',{code:replaced})).statusCode,401);
 const responses=await Promise.all([s.call('POST',base+'/recover',{code}),s.call('POST',base+'/recover',{code})]);
 assert.deepEqual(responses.map(r=>r.statusCode).sort(),[200,401]);
 const fresh=cookie(responses.find(r=>r.statusCode===200)!);
 assert.equal((await s.call('GET',base+'/me/pick-card',undefined,fresh)).statusCode,200);
 assert.equal((await s.call('PUT',base+'/me/pick-card',{...s.card,expectedCardRevision:0},fresh)).statusCode,409);
 assert.equal(value(await s.call('GET',base+'/game-day')).board,undefined);
 assert.equal((await s.call('GET',base+'/me/pick-card',undefined,player.session)).statusCode,401);
});
