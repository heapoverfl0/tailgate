import type {GameFact} from '../../domain/src/game-day.js';
export interface GameMapping {gameId:string;externalId:number;homeId:number;awayId:number;homeTeamId:string;awayTeamId:string;startDate:string}
type Row=Record<string,any>;
const row=(v:unknown):Row=>{if(!v || typeof v!=='object' || Array.isArray(v))throw new Error('INVALID_PROVIDER_DATA');return v as Row};
const score=(v:unknown):v is number=>Number.isInteger(v) && (v as number)>=0 && (v as number)<=200;
export function normalizeScoreboard(value:unknown,mapping:GameMapping):GameFact {
 const g=row(value),home=row(g.homeTeam),away=row(g.awayTeam);
 if(g.id!==mapping.externalId || home.id!==mapping.homeId || away.id!==mapping.awayId)throw new Error('PROVIDER_MAPPING_MISMATCH');
 const states:Record<string,GameFact['status']>={scheduled:'SCHEDULED',pregame:'SCHEDULED',in_progress:'IN_PROGRESS',inprogress:'IN_PROGRESS','in progress':'IN_PROGRESS',halftime:'IN_PROGRESS',completed:'FINAL',final:'FINAL',canceled:'VOID',cancelled:'VOID',postponed:'VOID'};
 const status=states[String(g.status).toLowerCase()];if(!status)throw new Error('UNKNOWN_PROVIDER_STATUS');
 if(status==='VOID')return {status};
 const fact:GameFact={status};
 if(status!=='SCHEDULED' && score(home.points) && score(away.points)){fact.home=home.points;fact.away=away.points;}
 if(status==='FINAL' && fact.home===undefined)throw new Error('MISSING_FINAL_SCORE');
 if(Number.isInteger(g.period) && g.period>0)fact.period=g.period;
 if(typeof g.clock==='string' && g.clock.length<=30)fact.clock=g.clock;
 const halfComplete=status==='FINAL' || String(g.status).toLowerCase()==='halftime' || g.period>=3;
 if(halfComplete && Array.isArray(home.lineScores) && Array.isArray(away.lineScores) && home.lineScores.length>=2 && away.lineScores.length>=2 && [...home.lineScores.slice(0,2),...away.lineScores.slice(0,2)].every(score)){
  const h=home.lineScores[0]+home.lineScores[1],a=away.lineScores[0]+away.lineScores[1];fact.halftime=h===a?'TIE':h>a?mapping.homeTeamId:mapping.awayTeamId;
 }
 return fact;
}
// Use cumulative score changes, not possession/offense, to identify defensive scores.
// Require a complete opening sequence and a recognized scoring play; otherwise leave unresolved.
export function firstScore(value:unknown,mapping:GameMapping):Pick<GameFact,'firstTeam'|'firstScore'> {
 const g=row(value);if(g.id!==mapping.externalId || !Array.isArray(g.drives))throw new Error('INVALID_PLAY_DATA');
 const plays:Row[]=g.drives.flatMap((d:Row)=>Array.isArray(d.plays)?d.plays:[]);
 const unique=[...new Map(plays.map(p=>[p.id,p])).values()].sort((a,b)=>{
  if(a.period!==b.period)return a.period-b.period;
  const sec=(s:unknown)=>typeof s==='string' && /^\d{1,2}:\d{2}$/.test(s)?Number(s.split(':')[0])*60+Number(s.split(':')[1]):-1;
  return sec(b.clock)-sec(a.clock) || String(a.id).localeCompare(String(b.id),undefined,{numeric:true});
 });
 if(!unique.length || unique[0]!.period!==1 || unique[0]!.clock!=='15:00' || unique[0]!.homeScore!==0 || unique[0]!.awayScore!==0)return {};
 for(const p of unique){
  if(!score(p.homeScore)||!score(p.awayScore))return {};
  if(p.homeScore+p.awayScore===0)continue;
  if((p.homeScore>0)===(p.awayScore>0))return {};
  const type=String(p.playType).toLowerCase();
  const kind=type.includes('touchdown')?'TOUCHDOWN':type==='field goal good'?'FIELD_GOAL':type.includes('safety')?'OTHER':undefined;
  if(!kind)return {};
  return {firstTeam:p.homeScore>0?mapping.homeTeamId:mapping.awayTeamId,firstScore:kind};
 }
 return {};
}
export class CfbdClient {
 constructor(private readonly key:string,private readonly request:typeof fetch=fetch){}
 async get(path:string):Promise<unknown>{
  if(!path.startsWith('/')||path.startsWith('//'))throw new Error('INVALID_PROVIDER_PATH');
  const response=await this.request('https://api.collegefootballdata.com'+path,{headers:{Authorization:`Bearer ${this.key}`,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(15000)});
  if(!response.ok){if(response.status===400 && path.startsWith('/live/plays?'))return undefined;throw new Error(`CFBD_HTTP_${response.status}`);}
  return response.json();
 }
}
