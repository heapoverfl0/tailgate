import type {ContestConfiguration} from '../../../packages/domain/src/index';
import type {DayView} from './GameDay';

export function FinalResults({id,config,view,participantId,shared=false}:{id:string;config:ContestConfiguration;view:DayView;participantId?:string;shared?:boolean}) {
 const board=view.board;
 if(view.contest.phase!=='FINAL'||!board)return null;
 const winners=board.entries.filter(e=>board.champions.includes(e.participantId));
 const awards:{title:string;names:string;reason:string}[]=[];
 const best=(title:string,metric:(e:NonNullable<DayView['board']>['entries'][number])=>number,reason:(n:number)=>string)=>{
  const maximum=Math.max(0,...board.entries.map(metric));
  if(maximum>0)awards.push({title,names:board.entries.filter(e=>metric(e)===maximum).map(e=>e.displayName).join(' & '),reason:reason(maximum)});
 };
 best('Upset prophet',e=>e.grades.filter(g=>g.result==='WIN'&&config.slots.find(s=>s.id===g.slotId)?.category==='UPSET_SPECIAL'&&e.picks.some(p=>p.slotId===g.slotId&&config.slots.find(s=>s.id===p.slotId)?.choices.some(ch=>ch.id===p.choiceId&&ch.kind!=='NO_UPSET'))).reduce((n,g)=>n+g.points,0),n=>`${n} points from a winning upset pick.`);
 best('Confidence without competence',e=>e.grades.filter(g=>g.result==='LOSS'&&config.slots.find(s=>s.id===g.slotId)?.category==='CONFIDENCE').reduce((n,g)=>n+(e.picks.find(p=>p.slotId===g.slotId)?.confidence??0),0),n=>`${n} confidence points placed on losing picks.`);
 if(board.entries.length>1){const low=Math.min(...board.entries.map(e=>e.points));if(board.entries.some(e=>e.points>low))awards.push({title:'Cellar dweller',names:board.entries.filter(e=>e.points===low).map(e=>e.displayName).join(' & '),reason:`${low} points. The only way is up.`});}
 return <section className={`final-stage ${shared?'final-shared':''}`} aria-label="Final results">
 <div className="final-identity"><span>{view.contest.name}</span>{shared&&<a href={`/?contest=${encodeURIComponent(id)}`}>Participant view ↗</a>}</div>
 <header className="final-hero"><span className="eyebrow">THE SCORES ARE SETTLED</span><h1>{winners.length>1?'TAILGATE CO-CHAMPIONS':winners.length===1?'TAILGATE CHAMPION':'CONTEST COMPLETE'}</h1><div className="final-winners">{winners.map(e=><div key={e.participantId}><strong>{e.displayName}</strong><p>{e.points} POINTS{e.participantId===participantId?' · THAT’S YOU':''}</p></div>)}</div><p>{winners.length?'Bragging rights secured. Receipts preserved.':'No champion was recorded.'}</p></header>
 <section className="final-table-panel"><h2>Final standings</h2><table><thead><tr><th scope="col">Rank</th><th scope="col">Player</th><th scope="col">Points</th></tr></thead><tbody>{board.entries.map(e=><tr key={e.participantId} className={board.champions.includes(e.participantId)?'final-winner-row':''}><td>{e.rank}</td><th scope="row">{e.displayName}{e.participantId===participantId&&<small>YOU</small>}{e.attendance==='REMOTE'&&<small>REMOTE</small>}{board.champions.includes(e.participantId)&&<small>CHAMPION</small>}</th><td>{e.points}</td></tr>)}</tbody></table><p className="final-note">Ranks reflect points; the Main Event score-prediction tiebreak determines the champion among tied leaders. An unresolved tiebreak leaves co-champions.</p></section>
 {awards.length>0&&<section><h2>The unofficial awards</h2><p className="final-note">For entertainment. These do not change points or champions. Tied awards are shared.</p><div className="final-awards">{awards.map(a=><article key={a.title}><h3>{a.title}</h3><strong>{a.names}</strong><p>{a.reason}</p></article>)}</div></section>}
 <p className="final-note">Final results saved. Void picks score zero; they are not counted as losing picks for awards.</p>
 </section>;
}
