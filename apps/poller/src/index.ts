import {createDynamoRepository} from '../../../packages/persistence/src/dynamo.js';
import type {Repository} from '../../../packages/persistence/src/repository.js';
import {CfbdClient,normalizeScoreboard,firstScore,type GameMapping} from '../../../packages/game-data/src/cfbd.js';
import type {GameFact} from '../../../packages/domain/src/game-day.js';
export async function poll(repository:Repository,client:Pick<CfbdClient,'get'>,id:string,mappings:GameMapping[],at:Date,dryRun=false) {
 let snapshot=await repository.getSnapshot(id);
 if(snapshot.contest.phase==='FINAL' || (!dryRun && at.getTime()<Date.parse(snapshot.contest.lockAt)))return {status:'inactive'};
 if(mappings.length!==snapshot.configuration.games.length || new Set(mappings.map(m=>m.gameId)).size!==mappings.length || new Set(mappings.map(m=>m.externalId)).size!==mappings.length || mappings.some(m=>!snapshot.configuration.games.some(g=>g.id===m.gameId && g.homeTeamId===m.homeTeamId && g.awayTeamId===m.awayTeamId)))throw new Error('CONTEST_MAPPING_MISMATCH');
 if(!dryRun && snapshot.contest.phase==='PREGAME') snapshot=await repository.updateDay(id,snapshot.contest.version,'lock',{});
 const board=await client.get('/scoreboard');if(!Array.isArray(board))throw new Error('INVALID_SCOREBOARD');
 const games:Record<string,GameFact>={};const warnings:string[]=[];
 for(const mapping of mappings){
  const rows=board.filter(g=>g.id===mapping.externalId);
  if(rows.length!==1){warnings.push(`missing_game:${mapping.gameId}`);continue;}
  try {
   const fact=normalizeScoreboard(rows[0],mapping);
   if(mapping.gameId===snapshot.configuration.mainEventGameId && ['IN_PROGRESS','FINAL'].includes(fact.status)) {
    try {
     const plays=await client.get(`/live/plays?gameId=${mapping.externalId}`);
     if(plays)Object.assign(fact,firstScore(plays,mapping));
     // Unavailable play data must not erase an already observed first score.
     if(!fact.firstTeam){const prior=snapshot.gameDay?.providerGames?.[mapping.gameId];if(prior?.firstTeam && prior.firstScore){fact.firstTeam=prior.firstTeam;fact.firstScore=prior.firstScore;}warnings.push('first_score_unavailable');}
    } catch {const prior=snapshot.gameDay?.providerGames?.[mapping.gameId];if(prior?.firstTeam&&prior.firstScore){fact.firstTeam=prior.firstTeam;fact.firstScore=prior.firstScore;}warnings.push('live_plays_unavailable');}
   }
   if(JSON.stringify(fact)!==JSON.stringify(snapshot.gameDay?.providerGames?.[mapping.gameId]))games[mapping.gameId]=fact;
  } catch {warnings.push(`invalid_game:${mapping.gameId}`);}
 }
 if(!dryRun && Object.keys(games).length) {
  // The version guard prevents a delayed observation overwriting a concurrent commissioner action.
  await repository.updateDay(id,snapshot.contest.version,'provider',{games});
 }
 return {status:Object.keys(games).length?'updated':'unchanged',changedGames:Object.keys(games),warnings};
}
export async function handler(event: {dryRun?:boolean} = {}) {
 const {CFBD_API_KEY,TAILGATE_TABLE,TAILGATE_CONTEST_ID,CFBD_MAPPINGS,POLL_START,POLL_END}=process.env;
 if(!CFBD_API_KEY||!TAILGATE_TABLE||!TAILGATE_CONTEST_ID||!CFBD_MAPPINGS||!POLL_START||!POLL_END)throw new Error('POLLER_NOT_CONFIGURED');
 const at=new Date();
 if(!Number.isFinite(Date.parse(POLL_START))||!Number.isFinite(Date.parse(POLL_END)))throw new Error('INVALID_POLL_WINDOW');
 if(!event.dryRun && (at.getTime()<Date.parse(POLL_START)||at.getTime()>Date.parse(POLL_END)))return {status:'outside_window'};
 try {
  const result=await poll(createDynamoRepository(TAILGATE_TABLE),new CfbdClient(CFBD_API_KEY),TAILGATE_CONTEST_ID,JSON.parse(CFBD_MAPPINGS),at,event.dryRun===true);
  console.log(JSON.stringify(result));return result;
 } catch { console.error('Poll failed; previous data retained.');throw new Error('POLLER_FAILED'); }
}
