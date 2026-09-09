import type { CardValidation, FrozenConfiguration, Selection, PickCard, Contest, ContestParticipant } from './model.js';
import { validateConfiguration } from './configuration.js';
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const score = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
export function validateCard(config: FrozenConfiguration, input: unknown): CardValidation {
  validateConfiguration(config);
  const issues: CardValidation['issues'] = [];
  const add = (code: string, message: string, slotId?: string) => issues.push({ code, message, ...(slotId === undefined ? {} : { slotId }) });
  if (!object(input) || !Array.isArray(input.picks)) return { valid: false, complete: false, issues: [{ code: 'INVALID_CARD', message: 'Card must contain a picks array' }], missingSlotIds: config.slots.map(s => s.id), predictionMissing: true, validSelections: [] };
  const picks = input.picks;
  const candidates: Selection[] = [];
  const slotCounts = new Map<string, number>();
  const confidenceSlots = new Map<number, Set<string>>();
  for (const pick of picks) {
    if (object(pick) && typeof pick.slotId === 'string') slotCounts.set(pick.slotId, (slotCounts.get(pick.slotId) ?? 0) + 1);
    if (!object(pick) || typeof pick.slotId !== 'string' || typeof pick.choiceId !== 'string') { add('INVALID_SELECTION', 'Selection needs slotId and choiceId'); continue; }
    const slot = config.slots.find(s => s.id === pick.slotId);
    if (!slot) { add('UNKNOWN_SLOT', 'Unknown slot', pick.slotId); continue; }
    if (slot.category === 'CONFIDENCE' && score(pick.confidence) && pick.confidence >= 1 && pick.confidence <= 6) {
      const slots = confidenceSlots.get(pick.confidence) ?? new Set<string>(); slots.add(slot.id); confidenceSlots.set(pick.confidence, slots);
    }
    if (!slot.choices.some(c => c.id === pick.choiceId)) { add('UNKNOWN_CHOICE', 'Choice does not belong to slot', slot.id); continue; }
    if (slot.category === 'CONFIDENCE') {
      if (pick.confidence === undefined) continue; // A winner without confidence is an incomplete draft pairing.
      if (!score(pick.confidence) || pick.confidence < 1 || pick.confidence > 6) { add('INVALID_CONFIDENCE', 'Confidence must be an integer 1–6', slot.id); continue; }
    } else if (pick.confidence !== undefined) { add('UNEXPECTED_CONFIDENCE', 'Only confidence slots accept confidence', slot.id); continue; }
    candidates.push({ slotId: pick.slotId, choiceId: pick.choiceId, ...(pick.confidence === undefined ? {} : { confidence: pick.confidence as Selection['confidence'] }) });
  }
  const invalid = new Set<string>();
  for (const [slotId, count] of slotCounts) if (count > 1) { invalid.add(slotId); add('DUPLICATE_SLOT', 'Slot occurs more than once', slotId); }
  for (const slots of confidenceSlots.values()) if (slots.size > 1) for (const slotId of slots) { invalid.add(slotId); add('DUPLICATE_CONFIDENCE', 'Confidence is assigned more than once', slotId); }
  const validSelections = candidates.filter(p => !invalid.has(p.slotId));
  const missingSlotIds = config.slots.filter(s => !validSelections.some(p => p.slotId === s.id)).map(s => s.id);
  const predictionMissing = input.prediction === undefined;
  if (!predictionMissing && (!object(input.prediction) || !score(input.prediction.home) || !score(input.prediction.away))) add('INVALID_PREDICTION', 'Predicted scores must be nonnegative integers');
  return { valid: issues.length === 0, complete: issues.length === 0 && missingSlotIds.length === 0 && !predictionMissing, issues, missingSlotIds, predictionMissing, validSelections };
}
export function prepareCardSave(config: FrozenConfiguration, contest: Contest, participant: ContestParticipant,
  input: unknown, expectedCardRevision: number, now: string, submit = false): { card: PickCard; submissionStatus: 'DRAFT' | 'SUBMITTED'; validation: CardValidation } {
  if (contest.id !== config.contestId || participant.contestId !== contest.id || participant.status !== 'ACTIVE') throw new Error('FORBIDDEN');
  if (!Number.isFinite(Date.parse(now)) || !Number.isFinite(Date.parse(contest.lockAt))) throw new Error('INVALID_TIME');
  if (contest.lockedAt || contest.phase !== 'PREGAME' || Date.parse(now) >= Date.parse(contest.lockAt)) throw new Error('LOCKED');
  if (!Number.isSafeInteger(expectedCardRevision) || expectedCardRevision < 0 || expectedCardRevision !== participant.cardRevision) throw new Error('CARD_REVISION_CONFLICT');
  const validation = validateCard(config, input);
  if (!validation.valid || ((submit || participant.submissionStatus === 'SUBMITTED') && !validation.complete)) throw new Error('INVALID_CARD');
  // Keep a partial winner/confidence draft; validation.validSelections intentionally contains only scoreable pairings.
  const raw = input as PickCard;
  const card: PickCard = { picks: raw.picks.map(p => ({ slotId: p.slotId, choiceId: p.choiceId, ...(p.confidence === undefined ? {} : { confidence: p.confidence }) })), ...(raw.prediction === undefined ? {} : { prediction: { home: raw.prediction.home, away: raw.prediction.away } }) };
  return { card, submissionStatus: submit || participant.submissionStatus === 'SUBMITTED' ? 'SUBMITTED' : 'DRAFT', validation };
}
