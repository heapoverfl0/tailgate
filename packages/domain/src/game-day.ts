import type { Contest, ContestConfiguration, ContestParticipant, PickCard, Resolution, ScorePrediction } from './model.js';
import { scoreCard, champions } from './scoring.js';
export interface GameFact {
  status: 'IN_PROGRESS' | 'FINAL' | 'VOID';
  home?: number; away?: number;
  firstTeam?: string; firstScore?: 'TOUCHDOWN' | 'FIELD_GOAL' | 'OTHER' | 'VOID';
  halftime?: string;
}
export interface GameDay { revealStep: number; games: Record<string, GameFact>; final?: ReturnType<typeof standings> }
export interface DaySnapshot { contest: Contest; configuration: ContestConfiguration; participants: Record<string, ContestParticipant>; cards: Record<string, PickCard>; gameDay?: GameDay }
export const revealTitles = ['Picks locked', 'The consensus', 'Lone wolves', 'Upset Special', 'Confidence on the line', 'The Main Event', 'The picks are public'];
export function resolutions(c: ContestConfiguration, games: Record<string, GameFact>): Record<string, Resolution> {
  const out: Record<string, Resolution> = {};
  for (const p of c.propositions) {
    const g = c.games.find(g => g.id === p.gameId)!; const f = games[g.id];
    let r: Resolution = {status:'UNRESOLVED'};
    if (f?.status === 'VOID') r={status:'VOID'};
    else if (f) {
      const team = (id: string): Resolution => ({status:'RESOLVED',outcome:{kind:'TEAM',teamId:id}});
      if (p.type==='FIRST_TEAM_TO_SCORE' && f.firstTeam) r=f.firstTeam==='VOID'?{status:'VOID'}:team(f.firstTeam);
      if (p.type==='FIRST_SCORE_TYPE' && f.firstScore) r=f.firstScore==='VOID'?{status:'VOID'}:{status:'RESOLVED',outcome:{kind:'SCORE_TYPE',scoreType:f.firstScore}};
      if (p.type==='HALFTIME_LEADER' && f.halftime) r=f.halftime==='VOID'?{status:'VOID'}:{status:'RESOLVED',outcome:f.halftime==='TIE'?{kind:'TIE'}:{kind:'TEAM',teamId:f.halftime}};
      if (f.status==='FINAL') {
        const home=f.home!, away=f.away!;
        if (p.type==='STRAIGHT_UP_WINNER') r=home===away?{status:'VOID'}:team(home>away?g.homeTeamId:g.awayTeamId);
        if (p.parameters.kind==='AGAINST_SPREAD') {
          const favored=p.parameters.favoredTeamId; const margin=(favored===g.homeTeamId?home-away:away-home)+p.parameters.spread;
          r=margin===0?{status:'PUSH'}:team(margin>0?favored:favored===g.homeTeamId?g.awayTeamId:g.homeTeamId);
        }
        if (p.parameters.kind==='GAME_TOTAL') r=home+away===p.parameters.total?{status:'VOID'}:{status:'RESOLVED',outcome:{kind:'TOTAL_SIDE',side:home+away>p.parameters.total?'OVER':'UNDER'}};
      }
    }
    out[p.id]=r;
  }
  return out;
}
export function standings(s: DaySnapshot) {
  const results=resolutions(s.configuration,s.gameDay?.games??{});
  const entries=Object.values(s.participants).filter(p=>p.status==='ACTIVE').map(p=>{
    const card=s.cards[p.participantId]!; const scored=scoreCard(s.configuration,card,results);
    return {participantId:p.participantId,displayName:p.displayName,attendance:p.attendance,points:scored.points,grades:scored.picks,picks:card.picks,...(card.prediction?{prediction:card.prediction}:{})};
  }).sort((a,b)=>b.points-a.points || a.displayName.localeCompare(b.displayName));
  const main=s.gameDay?.games[s.configuration.mainEventGameId];
  const actual: ScorePrediction|undefined=main?.status==='FINAL'?{home:main.home!,away:main.away!}:undefined;
  return {entries:entries.map(e=>({...e,rank:1+entries.filter(other=>other.points>e.points).length})),results,champions:champions(entries,actual)};
}
export function parseGameFact(c: ContestConfiguration, gameId: string, value: unknown): GameFact {
  const game=c.games.find(g=>g.id===gameId);
  if (!game || !value || typeof value!=='object' || Array.isArray(value)) throw new Error('INVALID_RESULT');
  const f=value as Record<string,unknown>;
  if (Object.keys(f).some(k=>!['status','home','away','firstTeam','firstScore','halftime'].includes(k)) || !['IN_PROGRESS','FINAL','VOID'].includes(String(f.status))) throw new Error('INVALID_RESULT');
  for (const field of ['home','away']) if (f[field]!==undefined && (!Number.isInteger(f[field]) || (f[field] as number)<0 || (f[field] as number)>200)) throw new Error('INVALID_RESULT');
  if ((f.home===undefined)!==(f.away===undefined) || (f.status==='FINAL' && f.home===undefined)) throw new Error('INVALID_RESULT');
  if (f.firstTeam!==undefined && ![game.homeTeamId,game.awayTeamId,'VOID'].includes(String(f.firstTeam))) throw new Error('INVALID_RESULT');
  if (f.firstScore!==undefined && !['TOUCHDOWN','FIELD_GOAL','OTHER','VOID'].includes(String(f.firstScore))) throw new Error('INVALID_RESULT');
  if ((f.firstTeam===undefined)!==(f.firstScore===undefined)) throw new Error('INVALID_RESULT');
  if (f.halftime!==undefined && ![game.homeTeamId,game.awayTeamId,'TIE','VOID'].includes(String(f.halftime))) throw new Error('INVALID_RESULT');
  if (f.status==='VOID' && Object.keys(f).length!==1) throw new Error('INVALID_RESULT');
  return structuredClone(f) as unknown as GameFact;
}
export function changeDay(s: DaySnapshot, action: string, body: Record<string,unknown>, at: string): void {
  if (action==='lock') {
    if (s.contest.phase!=='PREGAME' || Date.parse(at)<Date.parse(s.contest.lockAt)) throw new Error('NOT_READY');
    s.contest.lockedAt=at;s.contest.phase='REVEAL';s.gameDay={revealStep:0,games:{}};return;
  }
  const day=s.gameDay;
  if (!day || !s.contest.lockedAt) throw new Error('NOT_READY');
  if (action==='advance') {
    if (s.contest.phase!=='REVEAL' || day.revealStep>=6) throw new Error('NOT_READY');
    day.revealStep++; if (day.revealStep===6) s.contest.phase='LIVE'; return;
  }
  if (action==='result') {
    if (!['LIVE','MAIN_EVENT'].includes(s.contest.phase) || typeof body.reason!=='string' || !body.reason.trim() || body.reason.length>500 || typeof body.gameId!=='string') throw new Error('INVALID_RESULT');
    const fact=parseGameFact(s.configuration,body.gameId,body.fact);
    day.games[body.gameId]=fact;
    if (body.gameId===s.configuration.mainEventGameId && fact.status!=='VOID') s.contest.phase='MAIN_EVENT';
    return;
  }
  if (action==='finalize') {
    if (!['LIVE','MAIN_EVENT'].includes(s.contest.phase) || s.configuration.games.some(g=>!['FINAL','VOID'].includes(day.games[g.id]?.status??'')) || Object.values(resolutions(s.configuration,day.games)).some(r=>r.status==='UNRESOLVED')) throw new Error('NOT_READY');
    day.final=standings(s);s.contest.phase='FINAL';s.contest.finalizedAt=at;return;
  }
  throw new Error('INVALID_ACTION');
}
export function revealView(s: DaySnapshot) {
  const step=s.gameDay?.revealStep??0;
  const slots=s.configuration.slots.filter(slot=>step===5 ? slot.category==='MAIN_EVENT' : step===3 ? slot.category==='UPSET_SPECIAL' : [1,2,4].includes(step) && slot.category==='CONFIDENCE');
  const groups=slots.map(slot=>({slotId:slot.id,label:slot.label,choices:slot.choices.map(choice=>({choiceId:choice.id,players:Object.values(s.participants).filter(p=>p.status==='ACTIVE').flatMap(p=>{
    const pick=s.cards[p.participantId]?.picks.find(x=>x.slotId===slot.id && x.choiceId===choice.id);
    return pick?[{displayName:p.displayName,...(step>=4 && pick.confidence?{confidence:pick.confidence}:{})}]:[];
  })})).filter(ch=>step===1?ch.players.length>=2:step===2?ch.players.length===1:ch.players.length>0)})).filter(g=>g.choices.length>0);
  return {step,title:revealTitles[step],groups};
}
