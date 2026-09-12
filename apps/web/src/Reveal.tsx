import type {ContestConfiguration} from '../../../packages/domain/src/index';
import type {DayView} from './GameDay';
import {choiceLabel} from './Contest';
import {rankedLabel} from './team-label';
const titles=['Picks locked','The consensus','Lone wolves','Upset Special','They really believe','The Main Event'];
export function Reveal({id,config,view,admin,busy,advance,error,shared}:{id:string;config:ContestConfiguration;view:DayView;admin:boolean;busy:boolean;advance:()=>void;error:string;shared:boolean}){
 const r=view.reveal;if(!r)return null;
 return <section className="reveal-stage" aria-label="The Reveal"><div className="reveal-top"><span>{view.contest.name}</span><span>REVEAL {r.step+1} / 6</span>{shared&&<a href={`/?contest=${encodeURIComponent(id)}`}>Commissioner / participant view ↗</a>}</div>
 <header className="reveal-hero"><span className="eyebrow">{r.step===0?'NO MORE SECOND GUESSING':'THE CARDS ARE ON THE TABLE'}</span><h1>{titles[r.step]??r.title}</h1><p>{r.step===0?'Let’s see what these idiots did.':r.step===5?'Five picks. One last chance to be insufferable.':'Make your picks. Own the consequences.'}</p></header>
 {error&&<p role="alert" className="error">{error}</p>}
 <div className="reveal-progress" aria-label={`Reveal step ${r.step+1} of 6`}>{titles.map((title,i)=><span key={title} className={i===r.step?'current':i<r.step?'done':''}>{i+1}<small>{title}</small></span>)}</div>
 <div className="reveal-grid">{r.groups.map(g=><article key={g.slotId}><h2>{rankedLabel(g.label,config)}</h2>{g.choices.map(ch=>{const slot=config.slots.find(s=>s.id===g.slotId);const choice=slot?.choices.find(c=>c.id===ch.choiceId);return <div className="reveal-choice" key={ch.choiceId}><h3>{choice?choiceLabel(choice,config):'Pick unavailable'}</h3><div>{ch.players.map((p,i)=><p key={i}><strong>{p.displayName}</strong>{p.confidence!==undefined&&<b>{p.confidence}<small> PTS</small></b>}</p>)}</div></div>})}</article>)}</div>
 {r.step!==0&&!r.groups.length&&<p className="reveal-empty">No matching picks this round. The suspense survives.</p>}
 {view.commentary&&<aside className="host-commentary"><span>FROM THE CHEAP SEATS</span><p>{view.commentary.text}</p></aside>}
 <footer className="reveal-footer"><p>Picks are frozen. Full cards unlock together after the final Reveal step.</p>{admin?<button disabled={busy} onClick={advance}>{r.step===5?'Finish Reveal and publish all picks':'Next Reveal step →'}</button>:<p>The commissioner controls the pace.</p>}</footer></section>;
}
