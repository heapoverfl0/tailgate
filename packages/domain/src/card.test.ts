import test from 'node:test';
import assert from 'node:assert/strict';
import { freezeConfiguration, validateConfiguration, validateCard, prepareCardSave, scoreCard, champions, upsetPoints,
  type ContestConfiguration, type PropositionParameters, type PickSlot, type PickCard, type Resolution, type Contest, type ContestParticipant } from './index.js';

function fixture() {
  const c: ContestConfiguration = { contestId: 'week', mainEventGameId: 'main', games: [], propositions: [], slots: [] };
  for (const id of ['g1','g2','g3','g4','g5','g6','main']) c.games.push({ id, homeTeamId: `${id}-home`, awayTeamId: `${id}-away` });
  const add = (id: string, gameId: string, category: PickSlot['category'], parameters: PropositionParameters) => {
    c.propositions.push({ id, contestId: 'week', gameId, type: parameters.kind, parameters, label: id });
    const outcomes = parameters.kind === 'GAME_TOTAL' ? [{ kind: 'TOTAL_SIDE' as const, side: 'OVER' as const }, { kind: 'TOTAL_SIDE' as const, side: 'UNDER' as const }]
      : parameters.kind === 'FIRST_SCORE_TYPE' ? ['TOUCHDOWN','FIELD_GOAL','OTHER'].map(scoreType => ({ kind: 'SCORE_TYPE' as const, scoreType: scoreType as 'TOUCHDOWN' | 'FIELD_GOAL' | 'OTHER' }))
      : [{ kind: 'TEAM' as const, teamId: `${gameId}-home` }, { kind: 'TEAM' as const, teamId: `${gameId}-away` }, ...(parameters.kind === 'HALFTIME_LEADER' ? [{ kind: 'TIE' as const }] : [])];
    c.slots.push({ id, contestId: 'week', category, order: c.slots.length, label: id, required: true,
      choices: outcomes.map((outcome, i) => ({ id: `${id}-${i}`, kind: 'PROPOSITION_OUTCOME', propositionId: id, outcome })) });
  };
  for (let i=1; i<=6; i++) add(`c${i}`, `g${i}`, 'CONFIDENCE', { kind: 'STRAIGHT_UP_WINNER' });
  for (let i=1; i<=3; i++) add(`a${i}`, `g${i}`, 'ATS', { kind: 'AGAINST_SPREAD', favoredTeamId: `g${i}-home`, spread: -3, source: 'fixture', capturedAt: '2026-09-01T00:00:00Z' });
  c.slots.push({ id: 'upset', contestId: 'week', category: 'UPSET_SPECIAL', order: 9, label: 'Upset', required: true,
    choices: [{ id: 'dog', kind: 'PROPOSITION_OUTCOME', propositionId: 'c1', outcome: { kind: 'TEAM', teamId: 'g1-away' }, points: 6, moneyline: 700, source: 'fixture', capturedAt: '2026-09-01T00:00:00Z' }, { id: 'coward', kind: 'NO_UPSET', points: 1 }] });
  add('winner', 'main', 'MAIN_EVENT', { kind: 'STRAIGHT_UP_WINNER' });
  add('first', 'main', 'MAIN_EVENT', { kind: 'FIRST_TEAM_TO_SCORE' });
  add('play', 'main', 'MAIN_EVENT', { kind: 'FIRST_SCORE_TYPE' });
  add('half', 'main', 'MAIN_EVENT', { kind: 'HALFTIME_LEADER', allowTie: true });
  add('total', 'main', 'MAIN_EVENT', { kind: 'GAME_TOTAL', total: 52.5 });
  const card: PickCard = { picks: c.slots.map((s, i) => ({ slotId: s.id, choiceId: s.choices[0]!.id, ...(s.category === 'CONFIDENCE' ? { confidence: (i+1) as 1|2|3|4|5|6 } : {}) })), prediction: { home: 31, away: 27 } };
  // Select the same underdog in confidence and upset for a feasible perfect card.
  card.picks[0]!.choiceId = 'c1-1';
  card.picks.find(p => p.slotId === 'a1')!.choiceId = 'a1-1';
  const results: Record<string, Resolution> = {};
  for (const pick of card.picks) {
    const choice = c.slots.find(s => s.id === pick.slotId)!.choices.find(ch => ch.id === pick.choiceId)!;
    if (choice.kind === 'PROPOSITION_OUTCOME') results[choice.propositionId] = { status: 'RESOLVED', outcome: choice.outcome };
  }
  return { c, card, results };
}
const contest: Contest = { id: 'week', name: 'Week', timezone: 'America/Chicago', lockAt: '2026-09-12T16:00:00Z', phase: 'PREGAME', version: 10 };
const participant: ContestParticipant = { contestId: 'week', participantId: 'p', playerId: 'player', displayName: 'Player', attendance: 'REMOTE', status: 'ACTIVE', cardRevision: 2, submissionStatus: 'DRAFT' };
const before = '2026-09-12T15:00:00Z';

test('valid slate supports regular-category overlap and a complete 15-pick card', () => {
  const { c, card } = fixture();
  const v = validateCard(freezeConfiguration(c), card);
  assert.equal(v.complete, true); assert.equal(v.validSelections.length, 15);
});
test('empty drafts and winner-only drafts remain valid but incomplete', () => {
  const { c } = fixture();
  for (const card of [{ picks: [] }, { picks: [{ slotId: 'c1', choiceId: 'c1-0' }] }]) {
    const v = validateCard(c, card); assert.equal(v.valid, true); assert.equal(v.complete, false); assert.equal(v.validSelections.length, 0);
  }
});
test('unknown/malformed choices and duplicate slots are rejected', () => {
  const { c } = fixture();
  for (const card of [null, {}, { picks: [null] }, { picks: [{ slotId: 'bogus', choiceId: 'x' }] },
    { picks: [{ slotId: 'a1', choiceId: 'a2-0' }] }, { picks: [{ slotId: 'a1', choiceId: 'a1-0' }, { slotId: 'a1', choiceId: 'a1-1' }] }]) assert.equal(validateCard(c, card).valid, false);
});
test('confidence must be unique integers 1–6 and only occurs on confidence slots', () => {
  const { c, card } = fixture();
  for (const value of [0,7,1.5,NaN,'6']) {
    const input = structuredClone(card) as unknown as { picks: Record<string, unknown>[] };
    input.picks[0]!.confidence = value; assert.equal(validateCard(c, input).valid, false);
  }
  card.picks[1]!.confidence = 1;
  const v = validateCard(c, card); assert.equal(v.valid, false); assert.equal(v.validSelections.length, 13);
  assert.deepEqual(v.missingSlotIds, ['c1','c2']);
  assert.equal(validateCard(c, { picks: [{ slotId: 'a1', choiceId: 'a1-0', confidence: 1 }] }).valid, false);
});
test('submission requires prediction as well as complete selections', () => {
  const { c, card } = fixture(); delete card.prediction;
  assert.equal(validateCard(c, card).complete, false);
  assert.throws(() => prepareCardSave(c, contest, participant, card, 2, before, true), /INVALID_CARD/);
  card.prediction = { home: -1, away: 0 }; assert.equal(validateCard(c, card).valid, false);
});
test('Submit is explicit, permits later complete edits and rejects clearing submitted cards', () => {
  const { c, card } = fixture();
  assert.equal(prepareCardSave(c, contest, participant, card, 2, before).submissionStatus, 'DRAFT');
  assert.equal(prepareCardSave(c, contest, participant, card, 2, before, true).submissionStatus, 'SUBMITTED');
  const submitted = { ...participant, submissionStatus: 'SUBMITTED' as const };
  assert.equal(prepareCardSave(c, contest, submitted, card, 2, before).submissionStatus, 'SUBMITTED');
  assert.throws(() => prepareCardSave(c, contest, submitted, { picks: [] }, 2, before), /INVALID_CARD/);
});
test('save guard checks inclusive lock, early lock, participant scope and card revision independently of contest version', () => {
  const { c, card } = fixture();
  assert.throws(() => prepareCardSave(c, contest, participant, card, 2, contest.lockAt), /LOCKED/);
  assert.throws(() => prepareCardSave(c, { ...contest, lockedAt: before }, participant, card, 2, before), /LOCKED/);
  assert.throws(() => prepareCardSave(c, contest, participant, card, 1, before), /CONFLICT/);
  assert.throws(() => prepareCardSave(c, contest, { ...participant, contestId: 'other' }, card, 2, before), /FORBIDDEN/);
  assert.doesNotThrow(() => prepareCardSave(c, { ...contest, version: 999 }, participant, card, 2, before));
});
test('save detaches participant input and strips client-supplied grading', () => {
  const { c, card } = fixture();
  const input = { ...card, picks: card.picks.map(p => ({ ...p, pointsAwarded: 999 })) };
  const saved = prepareCardSave(c, contest, participant, input, 2, before).card;
  input.picks[0]!.choiceId = 'bad'; assert.equal(saved.picks[0]!.choiceId, 'c1-1');
  assert.equal('pointsAwarded' in saved.picks[0]!, false);
});
test('perfect feasible card scores 38; attendance is absent from scoring inputs', () => {
  const { c, card, results } = fixture(); assert.equal(scoreCard(c, card, results).points, 38);
});
test('NO_UPSET banks one even with all football propositions unresolved or void', () => {
  const { c } = fixture(); const card = { picks: [{ slotId: 'upset', choiceId: 'coward' }] };
  assert.equal(scoreCard(c, card, {}).points, 1);
  assert.equal(scoreCard(c, card, Object.fromEntries(c.propositions.map(p => [p.id, { status: 'VOID' }]))).points, 1);
});
test('missing picks score zero while valid picks on an incomplete card score normally', () => {
  const { c, card, results } = fixture(); card.picks = card.picks.filter(p => p.slotId !== 'upset');
  assert.equal(scoreCard(c, card, results).points, 32);
  assert.equal(scoreCard(c, { picks: [] }, results).points, 0);
});
test('all duplicate confidence pairings score zero, not the entire card', () => {
  const { c, card, results } = fixture(); card.picks[1]!.confidence = 1;
  assert.equal(scoreCard(c, card, results).points, 35);
});
test('ATS pushes score one; voids and losses score zero; unresolved picks do not bank', () => {
  const { c, card, results } = fixture();
  results.a1 = { status: 'PUSH' }; results.a2 = { status: 'VOID' }; results.a3 = { status: 'RESOLVED', outcome: { kind: 'TEAM', teamId: 'g3-away' } };
  results.winner = { status: 'UNRESOLVED' };
  assert.equal(scoreCard(c, card, results).points, 32);
});
test('resolved early Main Event propositions bank immediately and source corrections recalculate', () => {
  const { c, card } = fixture();
  const results: Record<string, Resolution> = { first: { status: 'RESOLVED', outcome: { kind: 'TEAM', teamId: 'main-home' } } };
  assert.equal(scoreCard(c, card, results).points, 1);
  results.first = { status: 'RESOLVED', outcome: { kind: 'TEAM', teamId: 'main-away' } };
  assert.equal(scoreCard(c, card, results).points, 0);
});
test('invalid outcomes and unspecified non-ATS pushes cannot silently award points', () => {
  const { c, card } = fixture();
  assert.throws(() => scoreCard(c, card, { total: { status: 'PUSH' } }), /Only ATS/);
  assert.throws(() => scoreCard(c, card, { first: { status: 'RESOLVED', outcome: { kind: 'TEAM', teamId: 'alien' } } }), /Invalid resolved/);
});
test('frozen lines, odds, choices and point values cannot be mutated through source or snapshot', () => {
  const { c, card, results } = fixture(); const frozen = freezeConfiguration(c);
  c.slots[9]!.choices[0]!.points = 2;
  assert.equal(scoreCard(frozen, card, results).points, 38);
  assert.throws(() => { (frozen as ContestConfiguration).slots[9]!.choices[0]!.points = 2; }, TypeError);
  assert.throws(() => { const params = (frozen as ContestConfiguration).propositions[6]!.parameters; if (params.kind === 'AGAINST_SPREAD') params.spread = -7; }, TypeError);
});
test('configuration rejects Main Event overlap, missing options and inconsistent question types', () => {
  const { c } = fixture();
  const overlap = structuredClone(c); overlap.mainEventGameId = 'g1'; assert.throws(() => validateConfiguration(overlap), /exclusive/);
  const missing = structuredClone(c); missing.slots[0]!.choices.pop(); assert.throws(() => validateConfiguration(missing), /every outcome/);
  const type = structuredClone(c); type.propositions[0]!.type = 'GAME_TOTAL'; assert.throws(() => validateConfiguration(type), /mismatch/);
  const duplicate = structuredClone(c); duplicate.slots[1]!.choices = structuredClone(duplicate.slots[0]!.choices); assert.throws(() => validateConfiguration(duplicate), /unique/);
});
test('working upset tiers have exact boundary behavior; invalid odds rejected', () => {
  for (const [line, points] of [[100,2],[199,2],[200,3],[299,3],[300,4],[449,4],[450,5],[699,5],[700,6],[1500,6]]) assert.equal(upsetPoints(line!), points);
  for (const line of [-100,99,NaN,100.5]) assert.throws(() => upsetPoints(line));
});
test('first place uses points then team-specific score error; remaining ties share championship', () => {
  const entries = [{ participantId: 'a', points: 30, prediction: { home: 31, away: 27 } }, { participantId: 'b', points: 30, prediction: { home: 28, away: 30 } }, { participantId: 'c', points: 29, prediction: { home: 28, away: 30 } }];
  assert.deepEqual(champions(entries, { home: 28, away: 30 }), ['b']);
  assert.deepEqual(champions(entries), ['a','b']);
  assert.deepEqual(champions(entries, { home: 30, away: 29 }), ['a','b']);
  assert.deepEqual(champions([]), []);
});

test('malformed duplicate slot cannot preserve the other copy for scoring', () => {
  const { c, results } = fixture();
  const card = { picks: [{ slotId: 'a1', choiceId: 'a1-1' }, { slotId: 'a1' }] };
  assert.equal(scoreCard(c, card, results).points, 0);
});
test('invalid upset provenance, score overrides, slate counts and foreign contest data are rejected', () => {
  const { c } = fixture();
  const odds = structuredClone(c); const dog = odds.slots[9]!.choices[0]!;
  if (dog.kind === 'PROPOSITION_OUTCOME') delete dog.source;
  assert.throws(() => freezeConfiguration(odds), /provenance/);
  const override = structuredClone(c); override.slots[6]!.choices[0]!.points = 10;
  assert.throws(() => freezeConfiguration(override), /override/);
  const count = structuredClone(c); count.slots.pop(); assert.throws(() => freezeConfiguration(count), /15 slots/);
  const foreign = structuredClone(c); foreign.propositions[0]!.contestId = 'other'; assert.throws(() => freezeConfiguration(foreign), /mismatch/);
});
test('missing final-score prediction never beats a valid prediction when actual score exists', () => {
  assert.deepEqual(champions([{ participantId: 'a', points: 10 }, { participantId: 'b', points: 10, prediction: { home: 1, away: 1 } }], { home: 0, away: 0 }), ['b']);
  assert.deepEqual(champions([{ participantId: 'a', points: 10 }, { participantId: 'b', points: 10 }], { home: 0, away: 0 }), ['a','b']);
});
