import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, DeleteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { fixture } from '../dist/packages/domain/src/fixture.js';
import { keys } from '../dist/packages/persistence/src/dynamo.js';

const origin = process.argv[2];
assert.match(origin, /^https:\/\/[a-z0-9]+\.cloudfront\.net$/);
const source = await readFile(new URL('../infra/terraform/secrets.auto.tfvars', import.meta.url), 'utf8');
const password = JSON.parse(source.match(/^commissioner_password\s*=\s*(".*")$/m)[1]);
const id = `smoke-${randomUUID()}`;
const base = `/api/contests/${id}`;
const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-2' }));
const sessions = [];
const call = async (method, path, body, cookie = '', expected = 200, requestOrigin = origin) => {
  const response = await fetch(origin + path, {
    method, redirect: 'error', signal: AbortSignal.timeout(20000),
    headers: { origin: requestOrigin, 'content-type': 'application/json', cookie },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  assert.equal(response.status, expected, `${method} ${path}: HTTP ${response.status}`);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  return { body: await response.json(), cookies: response.headers.getSetCookie() };
};
const sessionCookie = result => {
  assert.equal(result.cookies.length, 1);
  for (const flag of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/api']) assert.ok(result.cookies[0].includes(flag));
  return result.cookies[0].split(';')[0];
};
const query = async PK => {
  const items = []; let cursor;
  do {
    const r = await client.send(new QueryCommand({ TableName: 'tailgate', KeyConditionExpression: 'PK = :pk', ExpressionAttributeValues: { ':pk': PK }, ConsistentRead: true, ExclusiveStartKey: cursor }));
    items.push(...(r.Items ?? [])); cursor = r.LastEvaluatedKey;
  } while (cursor);
  return items;
};
try {
  await call('GET', '/api/health');
  await call('POST', '/api/commissioner/login', { password: 'wrong' }, '', 401);
  await call('POST', '/api/commissioner/login', { password }, '', 403, 'https://invalid.example');
  const admin = sessionCookie(await call('POST', '/api/commissioner/login', { password }));
  const { c, card } = fixture();
  c.contestId = id;
  for (const item of [...c.propositions, ...c.slots]) item.contestId = id;
  await call('POST', '/api/contests', { contest: { id, name: 'Synthetic deployment smoke test', timezone: 'UTC', lockAt: new Date(Date.now() + 3600000).toISOString() }, configuration: c }, admin, 201);
  const join = async name => {
    const { body: request } = await call('POST', `${base}/join-requests`, { displayName: name }, '', 201);
    const path = `${base}/join-requests/${request.requestId}`;
    const approved = await call('POST', `${path}/approve`, { attendance: 'REMOTE' }, admin);
    assert.deepEqual(approved.cookies, []);
    await call('POST', path, { requestSecret: 'wrong' }, '', 401);
    const cookie = sessionCookie(await call('POST', path, { requestSecret: request.requestSecret }));
    sessions.push(cookie.split('=')[1]);
    return cookie;
  };
  const a = await join('Synthetic A');
  const b = await join('Synthetic B');
  const saved = await call('PUT', `${base}/me/pick-card`, { ...card, expectedCardRevision: 0 }, a);
  assert.equal(saved.body.cardRevision, 1);
  const stale = await call('PUT', `${base}/me/pick-card`, { picks: [], expectedCardRevision: 0 }, a, 409);
  assert.equal(stale.body.error.details.cardRevision, 1);
  const submitted = await call('POST', `${base}/me/submit`, { expectedCardRevision: 1 }, a);
  assert.equal(submitted.body.submissionStatus, 'SUBMITTED');
  assert.equal((await call('GET', `${base}/me/pick-card`, undefined, a)).body.picks.length, 15);
  assert.deepEqual((await call('GET', `${base}/me/pick-card`, undefined, b)).body.picks, []);
  await call('GET', `${base}/me/pick-card`, undefined, admin, 401);
  for (const cookie of ['', admin, b]) {
    const view = (await call('GET', `${base}/pregame`, undefined, cookie)).body;
    assert.equal(view.cards, undefined); assert.equal(view.history, undefined);
    for (const p of view.participants) { assert.equal(p.picks, undefined); assert.equal(p.prediction, undefined); }
    assert.equal(view.participants.find(p => p.displayName === 'Synthetic A').completedSelections, 15);
  }
  const race=await Promise.all([1,2].map(async()=>{
    const response=await fetch(origin+`${base}/me/pick-card`,{method:'PUT',headers:{origin,'content-type':'application/json',cookie:a},body:JSON.stringify({...card,expectedCardRevision:2}),signal:AbortSignal.timeout(20000)});
    return response.status;
  }));
  assert.deepEqual(race.sort(),[200,409]);
  // Advance ONLY this uniquely named synthetic contest's deadline; never touch real contests.
  assert.ok(id.startsWith('smoke-'));
  await client.send(new UpdateCommand({TableName:'tailgate',Key:keys.contest(id),UpdateExpression:'SET lockAtMs = :ms, #d.#lock = :lock, #d.#v = #d.#v + :one',ConditionExpression:'#d.#id = :id AND #d.#phase = :pregame',ExpressionAttributeNames:{'#d':'data','#lock':'lockAt','#v':'version','#id':'id','#phase':'phase'},ExpressionAttributeValues:{':ms':Date.now()-1000,':lock':new Date(Date.now()-1000).toISOString(),':one':1,':id':id,':pregame':'PREGAME'}}));
  await call('PUT',`${base}/me/pick-card`,{...card,expectedCardRevision:3},a,409);
  let day=(await call('GET',`${base}/game-day`)).body;
  assert.equal(day.contest.phase,'REVEAL');assert.equal(day.board,undefined);assert.deepEqual(day.reveal.groups,[]);
  await call('POST',`${base}/game-day/advance`,{expectedVersion:day.contest.version},'',401);
  for(let step=0;step<6;step++){
    await call('POST',`${base}/game-day/advance`,{expectedVersion:day.contest.version},admin);
    day=(await call('GET',`${base}/game-day`)).body;
    if(step<5)assert.equal(day.board,undefined);
  }
  assert.equal(day.board.entries.find(e=>e.displayName==='Synthetic A').picks.length,15);
  assert.ok(day.board.entries.every(e=>e.projectedPoints===e.points&&Number.isFinite(e.remainingPoints)));
  assert.ok(day.board.paths.every(p=>p.status==='PENDING_EARLIER_GAMES'));
  for(const g of c.games){
    await call('POST',`${base}/game-day/result`,{expectedVersion:day.contest.version,gameId:g.id,fact:{status:'FINAL',home:31,away:27,...(g.id===c.mainEventGameId?{firstTeam:g.homeTeamId,firstScore:'TOUCHDOWN',halftime:'TIE'}:{})},reason:'Synthetic deployment test'},admin);
    day=(await call('GET',`${base}/game-day`)).body;
  }
  assert.ok(day.board.entries.every(e=>e.projectedPoints===e.points&&e.remainingPoints===0));
  assert.ok(day.board.paths.every(p=>p.status==='RESOLVED'));
  await call('POST',`${base}/game-day/finalize`,{expectedVersion:day.contest.version},admin);
  day=(await call('GET',`${base}/game-day`)).body;assert.equal(day.contest.phase,'FINAL');assert.equal(day.board.champions.length,1);
  console.log('HTTPS smoke passed: pregame privacy, concurrent edits, deadline lock, Reveal embargo, results and final standings');
} finally {
  // Only exact keys belonging to this unique synthetic contest are removed.
  const items = await query(`CONTEST#${id}`);
  const deletions = items.map(({ PK, SK }) => ({ PK, SK }));
  for (const item of items.filter(i => i.SK.startsWith('PARTICIPANT#'))) {
    deletions.push({ PK: `PLAYER#${item.data.playerId}`, SK: 'PROFILE' });
    for (const { PK, SK } of await query(`PICKHISTORY#${id}#${item.data.participantId}`)) deletions.push({ PK, SK });
  }
  for (const token of sessions) deletions.push(keys.session(token));
  for (const Key of deletions) await client.send(new DeleteCommand({ TableName: 'tailgate', Key }));
  assert.equal((await query(`CONTEST#${id}`)).length, 0);
  client.destroy();
  console.log(`Removed ${deletions.length} synthetic test records`);
}
