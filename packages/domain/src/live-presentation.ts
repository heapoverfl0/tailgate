import type {ContestConfiguration} from './model.js';
import type {GameFact,standings} from './game-day.js';
import {validateCard} from './card.js';
import {liveProjection} from './projections.js';
// Called with public standings only, after the Reveal embargo ends.
export function livePresentation(c:ContestConfiguration,board:ReturnType<typeof standings>,facts:Record<string,GameFact>) {
 const games=c.games.map(game=>{
  const props=c.propositions.filter(p=>p.gameId===game.id);
  const slots=c.slots.filter(s=>s.choices.some(ch=>ch.kind==='PROPOSITION_OUTCOME'&&props.some(p=>p.id===ch.propositionId)));
  const players=board.entries.flatMap(e=>{
   const picks=validateCard(c,{picks:e.picks}).validSelections.filter(p=>{
    const choice=c.slots.find(s=>s.id===p.slotId)!.choices.find(ch=>ch.id===p.choiceId)!;
    return choice.kind==='PROPOSITION_OUTCOME'&&props.some(prop=>prop.id===choice.propositionId);
   });
   picks.sort((a,b)=>c.slots.find(s=>s.id===a.slotId)!.order-c.slots.find(s=>s.id===b.slotId)!.order);
   if(!picks.length)return [];
   const projection=liveProjection(c,{picks},board.results,facts);
   const banked=picks.reduce((n,p)=>n+(e.grades.find(g=>g.slotId===p.slotId)?.points??0),0);
   return [{participantId:e.participantId,displayName:e.displayName,attendance:e.attendance,picks,banked,projected:projection.projectedPoints,remaining:projection.remainingPoints}];
  });
  const fact=facts[game.id];
  return {...game,fact,categories:[...new Set(slots.map(s=>s.category))],players,stakes:players.reduce((n,p)=>n+p.remaining,0)};
 });
 const active=games.filter(g=>g.fact?.status==='IN_PROGRESS');
 // Initial feature uses unresolved exposure; the display holds its choice while that game stays live.
 const featuredGameId=[...active].sort((a,b)=>b.stakes-a.stakes||a.id.localeCompare(b.id))[0]?.id;
 const projectionBreakdowns=board.entries.map(e=>{
  const pending=validateCard(c,{picks:e.picks}).validSelections.flatMap(pick=>{
   const slot=c.slots.find(s=>s.id===pick.slotId)!;
   const choice=slot.choices.find(ch=>ch.id===pick.choiceId)!;
   if(choice.kind==='NO_UPSET'||board.results[choice.propositionId]?.status!=='UNRESOLVED')return [];
   const prop=c.propositions.find(p=>p.id===choice.propositionId)!;
   return [{slotId:pick.slotId,choiceId:pick.choiceId,points:liveProjection(c,{picks:[pick]},board.results,facts).projectedPoints,gameStatus:facts[prop.gameId]?.status??'SCHEDULED'}];
  });
  return {participantId:e.participantId,banked:e.points,pending,total:e.points+pending.reduce((sum,p)=>sum+p.points,0)};
 });
 return {games,featuredGameId,projectionBreakdowns};
}
