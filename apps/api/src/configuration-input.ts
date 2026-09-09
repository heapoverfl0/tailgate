import { freezeConfiguration, type ContestConfiguration } from '../../../packages/domain/src/index.js';
const exact = (v: unknown, keys: string[]): Record<string, unknown> => {
  if (!v || typeof v !== 'object' || Array.isArray(v) || Object.keys(v).some(k => !keys.includes(k))) throw new Error('Invalid configuration fields');
  return v as Record<string, unknown>;
};
const text = (v: unknown) => { if (typeof v !== 'string' || !v.trim() || v.length > 200) throw new Error('Invalid text'); };
const array = (v: unknown): unknown[] => { if (!Array.isArray(v) || v.length > 100) throw new Error('Invalid array'); return v; };
export function parseConfiguration(input: unknown): ContestConfiguration {
  const c = exact(input, ['contestId','mainEventGameId','games','propositions','slots']); text(c.contestId); text(c.mainEventGameId);
  for (const raw of array(c.games)) { const g = exact(raw, ['id','homeTeamId','awayTeamId']); Object.values(g).forEach(text); }
  const types = ['STRAIGHT_UP_WINNER','AGAINST_SPREAD','FIRST_TEAM_TO_SCORE','FIRST_SCORE_TYPE','HALFTIME_LEADER','GAME_TOTAL'];
  for (const raw of array(c.propositions)) {
    const prop = exact(raw, ['id','contestId','gameId','label','type','parameters']);
    for (const k of ['id','contestId','gameId','label']) text(prop[k]);
    if (!types.includes(prop.type as string)) throw new Error('Invalid proposition type');
    const params = exact(prop.parameters, ['kind','favoredTeamId','spread','source','capturedAt','total','allowTie']);
    for (const key of ['source','capturedAt','favoredTeamId']) if (params[key] !== undefined) text(params[key]);
  }
  for (const raw of array(c.slots)) {
    const s = exact(raw, ['id','contestId','category','order','label','required','choices']);
    for (const k of ['id','contestId','label']) text(s[k]);
    if (!['CONFIDENCE','ATS','UPSET_SPECIAL','MAIN_EVENT'].includes(s.category as string) || !Number.isSafeInteger(s.order) || (s.order as number) < 0 || typeof s.required !== 'boolean') throw new Error('Invalid slot');
    for (const rawChoice of array(s.choices)) {
      const ch = exact(rawChoice, ['id','kind','propositionId','outcome','points','moneyline','source','capturedAt']); text(ch.id);
      if (ch.kind === 'NO_UPSET') { exact(ch, ['id','kind','points']); continue; }
      if (ch.kind !== 'PROPOSITION_OUTCOME') throw new Error('Invalid choice kind');
      text(ch.propositionId);
      for (const key of ['source','capturedAt']) if (ch[key] !== undefined) text(ch[key]);
      const o = exact(ch.outcome, ['kind','teamId','side','scoreType']);
      if (o.kind === 'TEAM') { exact(o, ['kind','teamId']); text(o.teamId); }
      else if (o.kind === 'TIE') exact(o, ['kind']);
      else if (o.kind === 'TOTAL_SIDE') { exact(o, ['kind','side']); if (!['OVER','UNDER'].includes(o.side as string)) throw new Error('Invalid total side'); }
      else if (o.kind === 'SCORE_TYPE') { exact(o, ['kind','scoreType']); if (!['TOUCHDOWN','FIELD_GOAL','OTHER'].includes(o.scoreType as string)) throw new Error('Invalid score type'); }
      else throw new Error('Invalid outcome');
    }
  }
  const config = c as unknown as ContestConfiguration;
  freezeConfiguration(config);
  return structuredClone(config);
}
