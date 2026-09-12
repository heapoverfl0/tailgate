import type {ContestConfiguration} from './model.js';
import type {GameFact,revealView,standings} from './game-day.js';
export interface Commentary { id:string; text:string }
const line=(id:string,text:string):Commentary=>({id,text});
// Accept only the embargo-filtered Reveal view, never private cards or history.
export function revealCommentary(c:ContestConfiguration,reveal:ReturnType<typeof revealView>):Commentary {
 const group=reveal.groups[0],choice=group?.choices[0];
 const selected=group&&choice?c.slots.find(s=>s.id===group.slotId)?.choices.find(ch=>ch.id===choice.choiceId):undefined;
 const team=selected?.kind==='PROPOSITION_OUTCOME'&&selected.outcome.kind==='TEAM'?selected.outcome.teamId:undefined;
 if(reveal.step===0)return line('locked','Picks are locked. Let’s see what these distinguished experts did.');
 if(reveal.step===1&&choice&&team)return line(`consensus:${group!.slotId}:${choice.choiceId}`,`${choice.players.length} people picked ${team}. A fearless group of independent thinkers.`);
 if(reveal.step===2&&choice?.players.length===1&&team)return line(`wolf:${group!.slotId}:${choice.choiceId}`,`${choice.players[0]!.displayName} stands alone on ${team}. We’re calling it conviction.`);
 if(reveal.step===3){
  for(const g of reveal.groups)for(const ch of g.choices)if(c.slots.find(s=>s.id===g.slotId)?.choices.find(x=>x.id===ch.choiceId)?.kind==='NO_UPSET')return line('cowards-point',`${ch.players.length} ${ch.players.length===1?'player chose':'players chose'} No Upset. Financially responsible. Spiritually disappointing.`);
  return line('upsets','The Upset Special: where confidence and evidence agree to see other people.');
 }
 if(reveal.step===4){for(const g of reveal.groups)for(const ch of g.choices){const p=ch.players.find(p=>p.confidence===6);if(p)return line(`six:${g.slotId}:${ch.choiceId}`,`${p.displayName} put six points on ${g.label}. A written statement of overconfidence.`);}}
 if(reveal.step===5)return line('main-reveal','Five Main Event picks. Plenty of ways to be confidently wrong.');
 return line(`reveal:${reveal.step}`,'The evidence is on the screen. The excuses are still being drafted.');
}
// Called only after public unlock. Current standings do not imply a lead change.
export function standingsCommentary(c:ContestConfiguration,board:ReturnType<typeof standings>,games:Record<string,GameFact>,final:boolean):Commentary|undefined {
 const entries=board.entries;if(!entries.length)return undefined;
 if(final){const names=entries.filter(e=>board.champions.includes(e.participantId)).map(e=>e.displayName);if(!names.length)return undefined;
  return line('champions:'+board.champions.join(':'),names.length===1?`${names[0]} wins. We regret to inform you that this will be mentioned again.`:`${names.join(' and ')} share the championship. Even the tiebreaker refused to choose sides.`);
 }
 if(entries.length<2)return line('waiting-for-company','One expert on the board. The competition is currently very polite.');
 for(const e of entries)for(const pick of e.picks){
  if(pick.confidence!==6)continue;
  const slot=c.slots.find(s=>s.id===pick.slotId),choice=slot?.choices.find(ch=>ch.id===pick.choiceId);
  if(slot?.category!=='CONFIDENCE'||choice?.kind!=='PROPOSITION_OUTCOME'||choice.outcome.kind!=='TEAM')continue;
  const prop=c.propositions.find(p=>p.id===choice.propositionId)!,g=c.games.find(g=>g.id===prop.gameId)!,f=games[g.id];
  if(f?.status!=='IN_PROGRESS'||f.home===undefined||f.away===undefined||f.home===f.away)continue;
  if(choice.outcome.teamId!==(f.home>f.away?g.homeTeamId:g.awayTeamId))return line(`six-trailing:${e.participantId}:${g.id}`,`${e.displayName} put six points on ${choice.outcome.teamId}, currently trailing. Confidence remains undefeated by evidence.`);
 }
 const top=Math.max(...entries.map(e=>e.points)),leaders=entries.filter(e=>e.points===top);
 if(top===0)return line('no-points','No points banked yet. Everyone’s reputation remains technically intact.');
 if(leaders.length===1){const leader=leaders[0]!;return line(`leader:${leader.participantId}`,leader.attendance==='REMOTE'?`${leader.displayName} leads from off-site. Apparently the commute was not required.`:`${leader.displayName} leads on banked points. Please direct all complaints to your own picks.`);}
 return line('tied-lead',`${leaders.length} players share the lead on banked points. Nobody gets exclusive bragging rights yet.`);
}
