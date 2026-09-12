import {rankedTeam,rankedLabel} from './team-label';
import {useEffect,useState} from 'react';
import type {ContestConfiguration,GameFact} from '../../../packages/domain/src/index';
import type {DayView} from './GameDay';
import {choiceLabel} from './Contest';
const category={CONFIDENCE:'CONF',ATS:'ATS',UPSET_SPECIAL:'UPSET',MAIN_EVENT:'MAIN'};
const clock=(f:GameFact|undefined)=>!f?'Upcoming':f.status==='FINAL'?'Final':f.status==='VOID'?'Void':f.status==='SCHEDULED'?'Upcoming':`${f.period?(f.period<=4?`Q${f.period}`:`OT${f.period-4}`):'Live'}${f.clock?` · ${f.clock}`:''}`;
export function SharedLive({id,config,view,refreshError}:{id:string;config:ContestConfiguration;view:DayView;refreshError:string}) {
 const {games,featuredGameId}=view.live!;const board=view.board!;
 const active=games.filter(g=>g.fact?.status==='IN_PROGRESS');
 const [openProjection,setOpenProjection]=useState<string>();
 const [selected,setSelected]=useState(featuredGameId);
 useEffect(()=>{if(!active.some(g=>g.id===selected))setSelected(featuredGameId);},[featuredGameId,selected,active.map(g=>g.id).join('|')]);
 const featured=games.find(g=>g.id===(selected??featuredGameId));
 const final=view.contest.phase==='FINAL';
 const names=board.entries.filter(e=>board.champions.includes(e.participantId)).map(e=>e.displayName);
 const label=(p:{slotId:string;choiceId:string})=>{const slot=config.slots.find(s=>s.id===p.slotId)!;return {slot,text:choiceLabel(slot.choices.find(ch=>ch.id===p.choiceId)!,config)}};
 return <div className="live-stage">
  <div className="live-topline"><div><span className="live-kicker">{final?'FINAL':view.contest.phase==='MAIN_EVENT'?'MAIN EVENT':'THE SATURDAY SCOREBOARD'}</span><h1>{view.contest.name}</h1></div><div className="live-top-actions"><b><i/>{active.length} {active.length===1?'GAME':'GAMES'} LIVE</b><a href={`/?contest=${encodeURIComponent(id)}`}>Participant view ↗</a></div></div>
  {refreshError&&<p className="error" role="alert">{refreshError} Showing the last received scores.</p>}
  {final&&<div className="champion-banner"><span>TAILGATE CHAMPION{names.length===1?'':'S'}</span><strong>{names.join(' & ')||'No players'}</strong></div>}
  <div className="live-columns">
   <section className="live-rank-panel"><div className="panel-title"><h2>Standings</h2><span>{board.entries.length} PLAYING</span></div>
    <table className="live-rank-table"><thead><tr><th scope="col">PLAYER</th><th scope="col">PTS</th><th scope="col">PROJ</th><th scope="col" title="Projected rank compared with banked rank">Δ RANK</th></tr></thead><tbody>{board.entries.map(e=>{const delta=e.rank-(e.projectedRank??e.rank);const breakdown=view.live?.projectionBreakdowns?.find(p=>p.participantId===e.participantId);return <tr key={e.participantId} className={e.rank===1?'rank-leading':''}><th scope="row"><span className="rank-number">{e.rank}</span><span>{e.displayName}{e.attendance==='REMOTE'&&<small className="remote-tag">REMOTE</small>}</span></th><td>{e.points}</td><td className="projected-number">{breakdown?<div className={`projection-detail ${openProjection===e.participantId?'is-open':''}`}><button type="button" aria-expanded={openProjection===e.participantId} onKeyDown={event=>{if(event.key==='Escape'){setOpenProjection(undefined);event.currentTarget.blur();}}} onClick={()=>setOpenProjection(openProjection===e.participantId?undefined:e.participantId)} aria-label={`Projection breakdown for ${e.displayName}: ${e.projectedPoints??e.points} points`}>{e.projectedPoints??e.points}</button><div className="projection-popover"><strong>{e.displayName} · Projected points</strong><p><span>Already banked</span><b>{breakdown.banked}</b></p>{breakdown.pending.map(p=>{const l=label(p);return <p key={p.slotId}><span>{l.slot.label} · {l.text}<small>{p.gameStatus==='IN_PROGRESS'?'If the current score holds':p.gameStatus==='SCHEDULED'?'Not started':'Awaiting resolution'}</small></span><b>+{p.points}</b></p>})}<p className="projection-total"><span>Projected total</span><b>{breakdown.total}</b></p><small>Not a forecast. Pending picks adding zero may still change.</small></div></div>:e.projectedPoints??e.points}</td><td className={delta>0?'rank-up':delta<0?'rank-down':'rank-flat'} aria-label={delta===0?'Projected rank unchanged':`Projected rank ${delta>0?'up':'down'} ${Math.abs(delta)}`}>{delta>0?'↑':delta<0?'↓':'—'}{delta!==0&&Math.abs(delta)}</td></tr>})}</tbody></table>
    <p className="rank-key"><strong>PTS</strong> banked · <strong>PROJ</strong> if live scores hold<br/>Arrows compare projected rank with banked rank.</p>

   </section>
   <section className="featured-panel"><div className="panel-title"><h2>Game to watch</h2><span>{featured?`${featured.stakes} PICK POINTS UNRESOLVED`:'BETWEEN GAMES'}</span></div>
    {featured?<><div className="featured-score"><div><span>{rankedTeam(featured.awayTeamId,config)}</span><strong>{featured.fact?.away??'—'}</strong></div><div><span>{rankedTeam(featured.homeTeamId,config)}</span><strong>{featured.fact?.home??'—'}</strong></div><p><b className="live-dot">LIVE</b> {clock(featured.fact)} {featured.fact?.clock&&<span>· observed clock</span>}</p></div>
     <div className="exposure-heading"><span>WHO’S GOT WHAT</span><span>AT STAKE</span></div>
     <div className="featured-exposure">{featured.players.map(p=><article key={p.participantId}><div className="exposure-person"><strong>{p.displayName}</strong><b>{p.remaining}<small> PTS</small></b></div><div className="exposure-picks">{p.picks.map(pick=>{const l=label(pick);return <div key={pick.slotId}><span className="category-chip">{category[l.slot.category]}</span><span>{l.text}</span>{pick.confidence&&<b>{pick.confidence}</b>}</div>})}</div></article>)}{!featured.players.length&&<p>No player picks on this game.</p>}</div>
    </>:<div className="no-live"><h3>{final?'The scores are settled.':'Waiting for the next kickoff.'}</h3><p>{final?'The bragging rights are permanent.':'Standings stay here. The next live contest game will appear automatically.'}</p></div>}
   </section>
  </div>
  <section className="other-games"><div className="section-label">AROUND THE SLATE</div><div className="game-strip">{games.filter(g=>g.id!==featured?.id).sort((a,b)=>Number(b.fact?.status==='IN_PROGRESS')-Number(a.fact?.status==='IN_PROGRESS')).map(g=><button type="button" className={`slate-game ${g.fact?.status==='IN_PROGRESS'?'is-live':''}`} key={g.id} onClick={()=>{if(g.fact?.status==='IN_PROGRESS')setSelected(g.id)}} disabled={g.fact?.status!=='IN_PROGRESS'} aria-label={`${rankedTeam(g.awayTeamId,config)} at ${rankedTeam(g.homeTeamId,config)}, ${clock(g.fact)}${g.fact?.status==='IN_PROGRESS'?', feature this game':''}`}><span className="slate-clock">{clock(g.fact)}</span><span>{rankedTeam(g.awayTeamId,config)}<b>{g.fact?.away??'—'}</b></span><span>{rankedTeam(g.homeTeamId,config)}<b>{g.fact?.home??'—'}</b></span><small>{g.categories.map(c=>category[c]).join(' / ')}</small></button>)}</div></section>
  <div className="live-bottom"><section className="score-implications"><span className="live-kicker">IF THIS SCORE HOLDS</span>{featured&&featured.fact?.home!==undefined&&featured.fact.away!==undefined?<><h3>{rankedTeam(featured.awayTeamId,config)} at {rankedTeam(featured.homeTeamId,config)}</h3><div>{featured.players.map(p=><p key={p.participantId}><span>{p.displayName}</span><b>+{p.projected-p.banked}</b></p>)}</div><small>Additional points implied by the current score, not a forecast.</small></>:<p>{final?'Final points are banked.':'Implications appear when live scores are available.'}</p>}</section>
   <aside className="host-commentary" aria-label="Tailgate commentary"><span>FROM THE CHEAP SEATS</span><p>{view.commentary?.text??'The next questionable decision is already on someone’s card.'}</p></aside>
  </div>
 </div>;
}
