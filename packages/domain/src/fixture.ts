// Synthetic test fixture; never production contest data.
import type { ContestConfiguration, PropositionParameters, PickSlot, PickCard, Resolution } from './index.js';
export function fixture() {
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
