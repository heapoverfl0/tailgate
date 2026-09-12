import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, DeleteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { keys } from '../dist/packages/persistence/src/dynamo.js';

const origin = process.argv[2];
assert.match(origin, /^https:\/\/[a-z0-9]+\.cloudfront\.net$/);
const source = await readFile(new URL('../infra/terraform/secrets.auto.tfvars', import.meta.url), 'utf8');
const password = JSON.parse(source.match(/^commissioner_password\s*=\s*(".*")$/m)[1]);
const id = `demo-${randomUUID()}`;
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
const admin=sessionCookie(await call('POST','/api/commissioner/login',{password}));
const payload=JSON.parse(await readFile(new URL('../contests/sept12-2026-revised.json',import.meta.url),'utf8'));
const c=payload.configuration;c.contestId=id;for(const x of [...c.slots,...c.propositions])x.contestId=id;
await call('POST','/api/contests',{contest:{id,name:'DEMO • Fictional players & scores',timezone:'America/New_York',lockAt:new Date(Date.now()+3600000).toISOString()},configuration:c},admin,201);
for(const [i,name] of ['Casey','Morgan','Riley','Jordan'].entries()){
 const request=(await call('POST',`${base}/join-requests`,{displayName:name},'',201)).body;
 const path=`${base}/join-requests/${request.requestId}`;
 await call('POST',path+'/approve',{attendance:i===1?'REMOTE':'ON_SITE'},admin);
 const cookie=sessionCookie(await call('POST',path,{requestSecret:request.requestSecret}));sessions.push(cookie.split('=')[1]);
 let n=0;const points=[1,2,3,6,5,4];
 const picks=c.slots.map((s,j)=>{let chosen=(i+j)%s.choices.length;
  if(s.id==='winner-alabama-kentucky')chosen=i===3?1:0;
  if(s.id==='upset-special')chosen=i;
  return {slotId:s.id,choiceId:s.choices[chosen].id,...(s.category==='CONFIDENCE'?{confidence:points[n++]}:{})};});
 await call('PUT',`${base}/me/pick-card`,{picks,prediction:{home:24+i*3,away:31-i*3},expectedCardRevision:0},cookie);
 await call('POST',`${base}/me/submit`,{expectedCardRevision:1},cookie);
}
assert.ok(id.startsWith('demo-'));
await client.send(new UpdateCommand({TableName:'tailgate',Key:keys.contest(id),UpdateExpression:'SET lockAtMs = :ms, #d.#lock = :lock, #d.#v = #d.#v + :one',ConditionExpression:'#d.#id = :id AND #d.#phase = :pregame',ExpressionAttributeNames:{'#d':'data','#lock':'lockAt','#v':'version','#id':'id','#phase':'phase'},ExpressionAttributeValues:{':ms':Date.now()-1000,':lock':new Date(Date.now()-1000).toISOString(),':one':1,':id':id,':pregame':'PREGAME'}}));
let day=(await call('GET',`${base}/game-day`)).body;
for(let step=0;step<6;step++){
 await call('POST',`${base}/game-day/advance`,{expectedVersion:day.contest.version},admin);
 day=(await call('GET',`${base}/game-day`)).body;
}
const scores={
 'oklahoma-michigan':{status:'FINAL',home:27,away:24},
 'arizona-state-texas-am':{status:'FINAL',home:35,away:17},
 'oregon-oklahoma-state':{status:'FINAL',home:14,away:42},
 'app-state-ecu':{status:'FINAL',home:28,away:21},
 'mississippi-state-minnesota':{status:'IN_PROGRESS',home:17,away:14,period:3,clock:'06:42'},
 'alabama-kentucky':{status:'IN_PROGRESS',home:21,away:14,period:3,clock:'08:15'},
};
for(const [gameId,fact] of Object.entries(scores)){
 await call('POST',`${base}/game-day/result`,{expectedVersion:day.contest.version,gameId,fact,reason:'DEMO ONLY — invented scores for presentation'},admin);
 day=(await call('GET',`${base}/game-day`)).body;
}
assert.equal(day.board.entries.length,4);assert.match(day.commentary.id,/six-trailing/);
for(const token of sessions)await client.send(new DeleteCommand({TableName:'tailgate',Key:keys.session(token)}));
client.destroy();
console.log(JSON.stringify({demoUrl:origin+`/?contest=${id}&display=1`,commentary:day.commentary.text,players:day.board.entries.map(e=>({name:e.displayName,points:e.points,projected:e.projectedPoints}))},null,2));
