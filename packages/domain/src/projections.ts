import type {ContestConfiguration,PickCard,Resolution,ScorePrediction,Selection} from './model.js';
import type {GameFact} from './game-day.js';
import {validateCard} from './card.js';
import {outcomeKey} from './configuration.js';
export function selectionPoints(c:ContestConfiguration,selection:Selection,r:Resolution):number {
 const slot=c.slots.find(s=>s.id===selection.slotId)!;const choice=slot.choices.find(ch=>ch.id===selection.choiceId)!;
 if(choice.kind==='NO_UPSET')return 1;
 if(r.status==='PUSH')return slot.category==='ATS'?1:0;
 if(r.status!=='RESOLVED'||outcomeKey(r.outcome)!==outcomeKey(choice.outcome))return 0;
 return slot.category==='CONFIDENCE'?selection.confidence!:slot.category==='ATS'?2:slot.category==='UPSET_SPECIAL'?choice.points!:1;
}
export function liveProjection(c:ContestConfiguration,card:PickCard,results:Record<string,Resolution>,games:Record<string,GameFact>) {
 const valid=validateCard(c,card).validSelections;let projectedPoints=0;let remainingPoints=0;
 for(const pick of valid){
  const slot=c.slots.find(s=>s.id===pick.slotId)!;const choice=slot.choices.find(ch=>ch.id===pick.choiceId)!;
  if(choice.kind==='NO_UPSET'){projectedPoints++;continue;}
  const prop=c.propositions.find(p=>p.id===choice.propositionId)!;const actual=results[prop.id]??{status:'UNRESOLVED'};
  if(actual.status!=='UNRESOLVED'){projectedPoints+=selectionPoints(c,pick,actual);continue;}
  remainingPoints+=slot.category==='CONFIDENCE'?pick.confidence!:slot.category==='ATS'?2:slot.category==='UPSET_SPECIAL'?choice.points!:1;
  const f=games[prop.gameId],g=c.games.find(g=>g.id===prop.gameId)!;
  if(f?.status!=='IN_PROGRESS'||f.home===undefined||f.away===undefined)continue;
  // Once halftime has passed, an absent halftime fact cannot be inferred from the current lead.
  if(prop.type==='HALFTIME_LEADER' && f.period!==undefined && f.period>=3)continue;
  let projection:Resolution={status:'UNRESOLVED'};
  if(prop.type==='STRAIGHT_UP_WINNER'||prop.type==='HALFTIME_LEADER')projection=f.home===f.away?(prop.type==='HALFTIME_LEADER'?{status:'RESOLVED',outcome:{kind:'TIE'}}:{status:'UNRESOLVED'}):{status:'RESOLVED',outcome:{kind:'TEAM',teamId:f.home>f.away?g.homeTeamId:g.awayTeamId}};
  if(prop.parameters.kind==='AGAINST_SPREAD'){
   const favored=prop.parameters.favoredTeamId;const margin=(favored===g.homeTeamId?f.home-f.away:f.away-f.home)+prop.parameters.spread;
   projection=margin===0?{status:'PUSH'}:{status:'RESOLVED',outcome:{kind:'TEAM',teamId:margin>0?favored:favored===g.homeTeamId?g.awayTeamId:g.homeTeamId}};
  }
  if(prop.parameters.kind==='GAME_TOTAL')projection=f.home+f.away===prop.parameters.total?{status:'VOID'}:{status:'RESOLVED',outcome:{kind:'TOTAL_SIDE',side:f.home+f.away>prop.parameters.total?'OVER':'UNDER'}};
  projectedPoints+=selectionPoints(c,pick,projection);
 }
 // Remaining is an exposure sum, not a claim that conflicting picks can all win.
 return {projectedPoints,remainingPoints};
}
export interface ScenarioEntry {participantId:string;points:number;picks:Selection[];prediction?:ScorePrediction}
export interface WinningPath {participantId:string;status:'ALIVE'|'NO_PATH'|'PENDING_EARLIER_GAMES'|'RESOLVED';example?:{home:number;away:number;firstTeam?:string;firstScore?:string;halftime?:string;points:number;coChampion:boolean}}
export function mainEventPaths(c:ContestConfiguration,entries:ScenarioEntry[],results:Record<string,Resolution>,games:Record<string,GameFact>):WinningPath[] {
 if(c.propositions.some(p=>p.gameId!==c.mainEventGameId && (results[p.id]?.status??'UNRESOLVED')==='UNRESOLVED'))return entries.map(e=>({participantId:e.participantId,status:'PENDING_EARLIER_GAMES'}));
 const game=c.games.find(g=>g.id===c.mainEventGameId)!;const f=games[game.id];
 const props=c.propositions.filter(p=>p.gameId===game.id);
 if(props.every(p=>(results[p.id]?.status??'UNRESOLVED')!=='UNRESOLVED'))return entries.map(e=>({participantId:e.participantId,status:'RESOLVED'}));
 const pending=props.filter(p=>(results[p.id]?.status??'UNRESOLVED')==='UNRESOLVED');
 const selections=entries.map(e=>validateCard(c,{picks:e.picks}).validSelections.filter(pick=>{const ch=c.slots.find(s=>s.id===pick.slotId)!.choices.find(ch=>ch.id===pick.choiceId)!;return ch.kind==='PROPOSITION_OUTCOME'&&pending.some(p=>p.id===ch.propositionId)}));
 const choices=selections.map(ps=>ps.map(pick=>c.slots.find(s=>s.id===pick.slotId)!.choices.find(ch=>ch.id===pick.choiceId)!).filter(ch=>ch.kind==='PROPOSITION_OUTCOME'));
 const byType=(type:string)=>props.find(p=>p.type===type);
 const known=(type:string)=>{const p=byType(type);return p?results[p.id]:undefined};
 const first=known('FIRST_TEAM_TO_SCORE'),play=known('FIRST_SCORE_TYPE'),half=known('HALFTIME_LEADER');
 const teams=first?.status==='RESOLVED'&&first.outcome.kind==='TEAM'?[first.outcome.teamId]:first?.status==='VOID'?['VOID']:[game.homeTeamId,game.awayTeamId];
 const plays=play?.status==='RESOLVED'&&play.outcome.kind==='SCORE_TYPE'?[play.outcome.scoreType]:play?.status==='VOID'?['VOID']:['TOUCHDOWN','FIELD_GOAL','OTHER'];
 const halves=half?.status==='RESOLVED'?[half.outcome.kind==='TEAM'?half.outcome.teamId:'TIE']:half?.status==='VOID'?['VOID']:[game.homeTeamId,game.awayTeamId,'TIE'];
 const patterns=new Map<string,{points:number[];contenders:number[]}>();
 const output:WinningPath[]=entries.map(e=>({participantId:e.participantId,status:'NO_PATH'}));
 // Exhaustive within the application's supported 0..200 score range. These are possibilities, not probabilities.
 const homeMin=f?.home??0,awayMin=f?.away??0;
 const homeMax=f?.status==='FINAL'?homeMin:200,awayMax=f?.status==='FINAL'?awayMin:200;
 for(let home=homeMin;home<=homeMax;home++)for(let away=awayMin;away<=awayMax;away++){
  if(home===away||home===1||away===1)continue;
  for(const firstTeam of teams)for(const firstScore of plays)for(const halftime of halves){
   const minimum=firstScore==='TOUCHDOWN'?6:firstScore==='FIELD_GOAL'?3:firstScore==='OTHER'?2:0;
   if(firstTeam!=='VOID' && (firstTeam===game.homeTeamId?home:away)<minimum)continue;
   if((f?.home??0)+(f?.away??0)>0 && firstTeam!=='VOID'){
    const already=firstTeam===game.homeTeamId?f?.home:f?.away;
    if(already!==undefined && already<minimum)continue;
   }
   if(f?.period && f.period<3){
    const h=f.home??0,a=f.away??0;
    if(halftime==='TIE' && Math.max(h,a)>Math.min(home,away))continue;
    if(halftime===game.homeTeamId && home<=a || halftime===game.awayTeamId && away<=h)continue;
   }
   if(halftime===game.homeTeamId&&home<2||halftime===game.awayTeamId&&away<2)continue;
   const patternKey=JSON.stringify([home>away,props.filter(p=>p.parameters.kind==='GAME_TOTAL').map(p=>p.parameters.kind==='GAME_TOTAL'?Math.sign(home+away-p.parameters.total):0),firstTeam,firstScore,halftime]);
   let pattern=patterns.get(patternKey);
   if(!pattern){
   const scenario:Record<string,Resolution>={};
   for(const p of pending){
    if(p.type==='STRAIGHT_UP_WINNER')scenario[p.id]={status:'RESOLVED',outcome:{kind:'TEAM',teamId:home>away?game.homeTeamId:game.awayTeamId}};
    else if(p.parameters.kind==='GAME_TOTAL')scenario[p.id]=home+away===p.parameters.total?{status:'VOID'}:{status:'RESOLVED',outcome:{kind:'TOTAL_SIDE',side:home+away>p.parameters.total?'OVER':'UNDER'}};
    else if(p.type==='FIRST_TEAM_TO_SCORE')scenario[p.id]=firstTeam==='VOID'?{status:'VOID'}:{status:'RESOLVED',outcome:{kind:'TEAM',teamId:firstTeam}};
    else if(p.type==='FIRST_SCORE_TYPE')scenario[p.id]=firstScore==='VOID'?{status:'VOID'}:{status:'RESOLVED',outcome:{kind:'SCORE_TYPE',scoreType:firstScore as 'TOUCHDOWN'|'FIELD_GOAL'|'OTHER'}};
    else if(p.type==='HALFTIME_LEADER')scenario[p.id]=halftime==='VOID'?{status:'VOID'}:{status:'RESOLVED',outcome:halftime==='TIE'?{kind:'TIE'}:{kind:'TEAM',teamId:halftime}};
   }
   const points=entries.map((e,i)=>e.points+choices[i]!.reduce((sum,ch)=>{const r=scenario[ch.propositionId];return sum+(r?.status==='RESOLVED' && outcomeKey(r.outcome)===outcomeKey(ch.outcome)?1:0)},0));
   const top=Math.max(...points);
   pattern={points,contenders:entries.map((_,i)=>i).filter(i=>points[i]===top)};patterns.set(patternKey,pattern);
   }
   if(pattern.contenders.every(i=>output[i]!.status==='ALIVE'))continue;
   const errors=pattern.contenders.map(i=>{const prediction=entries[i]!.prediction;return prediction?Math.abs(home-prediction.home)+Math.abs(away-prediction.away):Infinity});
   const best=Math.min(...errors);const winners=pattern.contenders.filter((_,j)=>errors[j]===best);
   for(const i of winners)if(output[i]!.status==='NO_PATH')output[i]={participantId:entries[i]!.participantId,status:'ALIVE',example:{home,away,firstTeam,firstScore,halftime,points:pattern.points[i]!,coChampion:winners.length>1}};
   if(output.every(p=>p.status==='ALIVE'))return output;
  }
 }
 return output;
}
