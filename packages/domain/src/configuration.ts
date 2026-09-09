import type { ContestConfiguration, FrozenConfiguration, Frozen, Outcome, Proposition, Game } from './model.js';

export function outcomeKey(outcome: Outcome): string {
  switch (outcome.kind) {
    case 'TEAM': return `TEAM:${outcome.teamId}`;
    case 'TOTAL_SIDE': return `TOTAL_SIDE:${outcome.side}`;
    case 'SCORE_TYPE': return `SCORE_TYPE:${outcome.scoreType}`;
    case 'TIE': return 'TIE';
  }
}
export function allowedOutcomes(prop: Frozen<Proposition>, game: Frozen<Game>): Outcome[] {
  const teams: Outcome[] = [{ kind: 'TEAM', teamId: game.homeTeamId }, { kind: 'TEAM', teamId: game.awayTeamId }];
  switch (prop.type) {
    case 'GAME_TOTAL': return [{ kind: 'TOTAL_SIDE', side: 'OVER' }, { kind: 'TOTAL_SIDE', side: 'UNDER' }];
    case 'FIRST_SCORE_TYPE': return ['TOUCHDOWN', 'FIELD_GOAL', 'OTHER'].map(scoreType => ({ kind: 'SCORE_TYPE', scoreType } as Outcome));
    case 'HALFTIME_LEADER': return [...teams, { kind: 'TIE' }];
    default: return teams;
  }
}
const requireCondition = (ok: boolean, message: string) => { if (!ok) throw new Error(`Invalid configuration: ${message}`); };
function unique(ids: readonly string[], label: string) {
  requireCondition(ids.every(id => typeof id === 'string' && id.trim().length > 0) && new Set(ids).size === ids.length, `${label} IDs must be nonempty and unique`);
}
const timestamp = (s: string | undefined) => typeof s === 'string' && Number.isFinite(Date.parse(s));
export function validateConfiguration(c: FrozenConfiguration): void {
  unique([c.contestId], 'contest'); unique(c.games.map(g => g.id), 'game');
  unique(c.propositions.map(p => p.id), 'proposition'); unique(c.slots.map(s => s.id), 'slot');
  requireCondition(c.games.some(g => g.id === c.mainEventGameId), 'Main Event game missing');
  for (const game of c.games) unique([game.homeTeamId, game.awayTeamId], 'team');
  for (const prop of c.propositions) {
    const game = c.games.find(g => g.id === prop.gameId);
    requireCondition(!!game && prop.contestId === c.contestId && prop.type === prop.parameters.kind, 'proposition ownership/type mismatch');
    const params = prop.parameters;
    if (params.kind === 'AGAINST_SPREAD') requireCondition(
      [game!.homeTeamId, game!.awayTeamId].includes(params.favoredTeamId) && Number.isFinite(params.spread)
      && params.spread <= 0 && params.spread * 2 === Math.round(params.spread * 2)
      && !!params.source.trim() && timestamp(params.capturedAt), 'invalid spread or missing provenance');
    if (params.kind === 'GAME_TOTAL') requireCondition(Number.isFinite(params.total) && params.total > 0
      && params.total * 2 === Math.round(params.total * 2), 'invalid total');
    if (params.kind === 'HALFTIME_LEADER') requireCondition(params.allowTie === true, 'halftime requires tie choice');
  }
  const counts = { CONFIDENCE: 6, ATS: 3, UPSET_SPECIAL: 1, MAIN_EVENT: 5 };
  requireCondition(c.slots.length === 15, 'card must have 15 slots');
  for (const [category, count] of Object.entries(counts)) requireCondition(c.slots.filter(s => s.category === category).length === count, `wrong ${category} slot count`);
  for (const slot of c.slots) {
    requireCondition(slot.contestId === c.contestId && slot.required === true, 'slot ownership/required mismatch');
    unique(slot.choices.map(choice => choice.id), 'choice');
    requireCondition(slot.choices.length > 0, 'empty choices');
    const propositions = new Set<string>(); const selections: string[] = [];
    for (const choice of slot.choices) {
      if (choice.kind === 'NO_UPSET') {
        requireCondition(slot.category === 'UPSET_SPECIAL' && choice.points === 1, 'NO_UPSET only allowed in Upset');
        selections.push('NO_UPSET'); continue;
      }
      const prop = c.propositions.find(p => p.id === choice.propositionId);
      requireCondition(!!prop, 'choice references missing proposition');
      const game = c.games.find(g => g.id === prop!.gameId)!;
      requireCondition(allowedOutcomes(prop!, game).some(o => outcomeKey(o) === outcomeKey(choice.outcome)), 'invalid choice outcome');
      requireCondition(slot.category === 'MAIN_EVENT' ? game.id === c.mainEventGameId : game.id !== c.mainEventGameId, 'Main Event must be exclusive');
      if (slot.category === 'CONFIDENCE' || slot.category === 'UPSET_SPECIAL') requireCondition(prop!.type === 'STRAIGHT_UP_WINNER', 'straight-up proposition required');
      if (slot.category === 'ATS') requireCondition(prop!.type === 'AGAINST_SPREAD', 'ATS proposition required');
      if (slot.category === 'UPSET_SPECIAL') requireCondition(Number.isInteger(choice.points) && choice.points! >= 2 && choice.points! <= 6
        && Number.isInteger(choice.moneyline) && choice.moneyline! >= 100 && !!choice.source?.trim() && timestamp(choice.capturedAt), 'upset needs frozen points, positive odds and provenance');
      else requireCondition(choice.points === undefined || choice.points === (slot.category === 'MAIN_EVENT' ? 1 : slot.category === 'ATS' ? 2 : undefined), 'unexpected scoring override');
      propositions.add(prop!.id); selections.push(`${prop!.id}:${outcomeKey(choice.outcome)}`);
    }
    unique(selections, 'semantic choice');
    if (slot.category === 'UPSET_SPECIAL') {
      requireCondition(slot.choices.filter(c => c.kind === 'NO_UPSET').length === 1 && propositions.size >= 1, 'Upset requires candidates and one NO_UPSET');
      requireCondition(propositions.size === slot.choices.length - 1, 'one underdog per game proposition');
      unique([...propositions].map(id => c.propositions.find(p => p.id === id)!.gameId), 'upset game');
    } else {
      requireCondition(propositions.size === 1, 'slot must map to one proposition');
      const prop = c.propositions.find(p => p.id === [...propositions][0])!;
      const game = c.games.find(g => g.id === prop.gameId)!;
      requireCondition(slot.choices.length === allowedOutcomes(prop, game).length, 'slot must offer every outcome');
    }
  }
  for (const category of ['CONFIDENCE', 'ATS'] as const) {
    const games = c.slots.filter(s => s.category === category).map(s => {
      const choice = s.choices[0]!;
      return choice.kind === 'PROPOSITION_OUTCOME' ? c.propositions.find(p => p.id === choice.propositionId)!.gameId : '';
    });
    unique(games, `${category} game`);
  }
  const mainTypes = c.slots.filter(s => s.category === 'MAIN_EVENT').map(s => {
    const choice = s.choices[0]!;
    return choice.kind === 'PROPOSITION_OUTCOME' ? c.propositions.find(p => p.id === choice.propositionId)!.type : '';
  });
  requireCondition(['STRAIGHT_UP_WINNER','FIRST_TEAM_TO_SCORE','FIRST_SCORE_TYPE','HALFTIME_LEADER','GAME_TOTAL'].every(t => mainTypes.includes(t as typeof mainTypes[number])), 'Main Event requires all five proposition types');
}
function deepFreeze<T>(value: T): Frozen<T> {
  if (value && typeof value === 'object') { Object.values(value).forEach(deepFreeze); Object.freeze(value); }
  return value as Frozen<T>;
}
// Call at contest open; persist this detached snapshot and disallow configuration updates thereafter.
export function freezeConfiguration(c: ContestConfiguration): FrozenConfiguration {
  validateConfiguration(c); return deepFreeze(structuredClone(c));
}
export function upsetPoints(moneyline: number): number {
  if (!Number.isInteger(moneyline) || moneyline < 100) throw new RangeError('Underdog moneyline must be an integer >= +100');
  return moneyline < 200 ? 2 : moneyline < 300 ? 3 : moneyline < 450 ? 4 : moneyline < 700 ? 5 : 6;
}
