import type { PickResult, ScoringRule } from '../../contracts/src/index.js';
export function pointsFor(result: PickResult, rule: ScoringRule): number {
  if (rule.kind === 'CONFIDENCE' && (!Number.isInteger(rule.value) || rule.value < 1 || rule.value > 6)) throw new RangeError('Confidence must be 1–6');
  if (rule.kind === 'UPSET' && (!Number.isInteger(rule.value) || rule.value < 2 || rule.value > 6)) throw new RangeError('Upset value must be 2–6');
  if (result === 'PUSH') return rule.kind === 'ATS' ? 1 : 0;
  if (result !== 'WIN') return 0;
  return rule.kind === 'ATS' ? 2 : rule.kind === 'MAIN_EVENT' ? 1 : rule.value;
}
export function scorePredictionError(predicted: readonly [number, number], actual: readonly [number, number]): number {
  if (![...predicted, ...actual].every(n => Number.isInteger(n) && n >= 0)) throw new RangeError('Scores must be nonnegative integers');
  return Math.abs(predicted[0] - actual[0]) + Math.abs(predicted[1] - actual[1]);
}
