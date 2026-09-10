import test from 'node:test';
import assert from 'node:assert/strict';
import { createLambdaHandler, type HttpEvent } from './index.js';
import { createService } from './service.js';
import { MemoryStore } from '../../../packages/persistence/src/store.js';
import { StoreRepository } from '../../../packages/persistence/src/repository.js';
const settings = { origin: 'https://tailgate.test', password: 'test-password', signingSecret: 'test-signing-secret-at-least-32-characters', secureCookies: true };
const event = (path: string, method = 'GET'): HttpEvent => ({ rawPath: path, requestContext: { http: { method } } });
test('Lambda uses the real service and returns private no-cache JSON responses', async () => {
  const handler = createLambdaHandler(createService(new StoreRepository(new MemoryStore()), settings));
  const health = await handler(event('/api/health'));
  assert.equal(health.statusCode, 200); assert.equal(health.headers['cache-control'], 'no-store');
  assert.equal((await handler(event('/api/contests/missing'))).statusCode, 404);
  const login = await handler({ ...event('/api/commissioner/login', 'POST'), headers: { Origin: settings.origin, 'Content-Type': 'application/json' }, body: Buffer.from(JSON.stringify({ password: settings.password })).toString('base64'), isBase64Encoded: true });
  assert.equal(login.statusCode, 200); assert.match(login.cookies![0]!, /HttpOnly.*Secure/);
  const list = await handler({ ...event('/api/contests/missing/join-requests'), cookies: [login.cookies![0]!.split(';')[0]!] });
  assert.equal(list.statusCode, 404); // authenticated, then contest lookup
});
test('Lambda rejects malformed, non-JSON and oversized bodies before calling service', async () => {
  let calls = 0; const handler = createLambdaHandler(async () => { calls++; return { statusCode: 200, body: {} }; });
  for (const [body, type, expected] of [['{','application/json',400],['{}','text/plain',415],['x'.repeat(131073),'application/json',413]] as const) {
    const response = await handler({ ...event('/api/contests','POST'), headers: { 'content-type': type }, body });
    assert.equal(response.statusCode, expected);
  }
  assert.equal(calls, 0);
});
