import test from 'node:test';
import assert from 'node:assert/strict';
import { pointsFor, scorePredictionError } from './index.js';
test('ATS distinguishes wins, pushes and unavailable outcomes', () => {
  assert.equal(pointsFor('WIN', { kind: 'ATS' }), 2);
  assert.equal(pointsFor('PUSH', { kind: 'ATS' }), 1);
  for (const result of ['LOSS', 'PENDING', 'VOID'] as const) assert.equal(pointsFor(result, { kind: 'ATS' }), 0);
});
test('confidence uses all six values for 21 available points', () => {
  assert.equal([1,2,3,4,5,6].reduce((sum, value) => sum + pointsFor('WIN', { kind: 'CONFIDENCE', value }), 0), 21);
  assert.throws(() => pointsFor('WIN', { kind: 'CONFIDENCE', value: 7 }));
});
test('resolved Main Event points bank immediately', () => assert.equal(pointsFor('WIN', { kind: 'MAIN_EVENT' }), 1));
test('tiebreak uses team-specific absolute error', () => {
  assert.equal(scorePredictionError([31,27], [28,30]), 6);
  assert.equal(scorePredictionError([28,30], [28,30]), 0);
  assert.throws(() => scorePredictionError([-1,0], [0,0]));
});
