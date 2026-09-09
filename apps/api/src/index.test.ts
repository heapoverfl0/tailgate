import test from 'node:test';
import assert from 'node:assert/strict';
import { handler } from './index.js';
const request = (rawPath: string, method = 'GET') => handler({ rawPath, requestContext: { http: { method } } });
test('health and seeded contest are readable without exposing picks', async () => {
  assert.equal((await request('/api/health')).statusCode, 200);
  const result = await request('/api/contests/demo');
  assert.deepEqual(JSON.parse(result.body), { id: 'demo', title: 'Tailgate Pick’em — Demo', phase: 'PREGAME', version: 1 });
});
test('unknown contests and unimplemented mutations return 404', async () => {
  const missing = await request('/api/contests/missing');
  assert.equal(missing.statusCode, 404);
  assert.deepEqual(JSON.parse(missing.body), { error: { code: 'NOT_FOUND', message: 'Not found' } });
  assert.equal((await request('/api/contests/demo', 'PUT')).statusCode, 404);
});
