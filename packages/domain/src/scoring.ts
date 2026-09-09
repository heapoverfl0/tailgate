import type { FrozenConfiguration, Resolution, ScorePrediction } from './model.js';
import { validateCard } from './card.js';
import { allowedOutcomes, outcomeKey } from './configuration.js';
import type { PickResult } from '../../contracts/src/index.js';
import { pointsFor, scorePredictionError } from './primitives.js';
export function scoreCard(config: FrozenConfiguration, card: unknown, resolutions: Readonly<Record<string, Resolution>>) {
  const validation = validateCard(config, card);
  const picks = config.slots.map(slot => {
    const selection = validation.validSelections.find(p => p.slotId === slot.id);
    if (!selection) return { slotId: slot.id, result: 'VOID' as PickResult, points: 0, reason: 'MISSING_OR_INVALID' };
    const choice = slot.choices.find(c => c.id === selection.choiceId)!;
    if (choice.kind === 'NO_UPSET') return { slotId: slot.id, result: 'WIN' as PickResult, points: 1 };
    const prop = config.propositions.find(p => p.id === choice.propositionId)!;
    const resolution = resolutions[prop.id] ?? { status: 'UNRESOLVED' };
    let result: PickResult;
    switch (resolution.status) {
      case 'UNRESOLVED': result = 'PENDING'; break;
      case 'VOID': result = 'VOID'; break;
      case 'PUSH':
        if (prop.type !== 'AGAINST_SPREAD') throw new Error('Only ATS push scoring is specified');
        result = 'PUSH'; break;
      case 'RESOLVED': {
        const game = config.games.find(g => g.id === prop.gameId)!;
        if (!allowedOutcomes(prop, game).some(o => outcomeKey(o) === outcomeKey(resolution.outcome))) throw new Error('Invalid resolved outcome');
        result = outcomeKey(choice.outcome) === outcomeKey(resolution.outcome) ? 'WIN' : 'LOSS'; break;
      }
    }
    const rule = slot.category === 'CONFIDENCE' ? { kind: 'CONFIDENCE' as const, value: selection.confidence! }
      : slot.category === 'UPSET_SPECIAL' ? { kind: 'UPSET' as const, value: choice.points! }
      : { kind: slot.category };
    return { slotId: slot.id, result, points: pointsFor(result, rule) };
  });
  return { points: picks.reduce((sum, p) => sum + p.points, 0), picks, validation };
}
export function champions(entries: readonly { participantId: string; points: number; prediction?: ScorePrediction }[], actual?: ScorePrediction): string[] {
  if (new Set(entries.map(e => e.participantId)).size !== entries.length || entries.some(e => !Number.isSafeInteger(e.points) || e.points < 0)) throw new Error('Invalid standings');
  if (actual) scorePredictionError([actual.home, actual.away], [actual.home, actual.away]);
  for (const e of entries) if (e.prediction) scorePredictionError([e.prediction.home, e.prediction.away], [0, 0]);
  if (!entries.length) return [];
  const top = entries.filter(e => e.points === Math.max(...entries.map(e => e.points)));
  if (!actual) return top.map(e => e.participantId);
  const errors = top.map(e => e.prediction ? scorePredictionError([e.prediction.home, e.prediction.away], [actual.home, actual.away]) : Infinity);
  const best = Math.min(...errors);
  return top.filter((_, i) => errors[i] === best).map(e => e.participantId);
}
