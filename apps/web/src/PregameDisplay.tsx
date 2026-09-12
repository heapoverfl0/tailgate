import type {View} from './Contest';
export function PregameDisplay({id,view,now,joinUrl,qrAvailable,error}:{id:string;view:View;now:number;joinUrl:string;qrAvailable:boolean;error:string}) {
 const seconds=Math.max(0,Math.ceil((Date.parse(view.contest.lockAt)-now)/1000));
 const time=`${Math.floor(seconds/3600)}:${String(Math.floor(seconds/60)%60).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
 const players=view.participants.filter(p=>p.status==='ACTIVE');const submitted=players.filter(p=>p.submissionStatus==='SUBMITTED').length;
 const pending=players.filter(p=>p.submissionStatus!=='SUBMITTED');
 const windows=new Map<string,{order:number;games:typeof view.configuration.games}>();
 for(const game of view.configuration.games){
  const props=view.configuration.propositions.filter(p=>p.gameId===game.id);
  const labels=view.configuration.slots.filter(s=>s.choices.some(ch=>ch.kind==='PROPOSITION_OUTCOME'&&props.some(p=>p.id===ch.propositionId))).map(s=>s.label);
  const times=labels.map(label=>label.match(/·\s*(\d{1,2}):(\d{2})\s*([ap])\.m\.\s*ET/)).filter(m=>m!==null);
  const match=times[0];
  const minutes=match?(Number(match[1])%12+(match[3]==='p'?12:0))*60+Number(match[2]):undefined;
  const key=game.id===view.configuration.mainEventGameId?'Main Event':minutes===720?'Noon ET':match?`${match[1]}:${match[2]} ${match[3]}.m. ET`:'Time to be announced';
  const group=windows.get(key)??{order:game.id===view.configuration.mainEventGameId?2000:minutes??3000,games:[]};
  group.games.push(game);windows.set(key,group);
 }
 const categories={CONFIDENCE:'Confidence',ATS:'ATS',UPSET_SPECIAL:'Upset',MAIN_EVENT:'Main Event'};
 return <div className="pregame-stage"><div className="pregame-top"><div><span className="eyebrow">THE PREGAME STARTS HERE</span><h1>{view.contest.name}</h1></div><div className={`pregame-clock ${seconds<=60?'urgent':''}`}><span>{seconds===0?'PICKS LOCKED':seconds<=300?'PICKS LOCK SOON':'LOCKS IN'}</span><strong>{time}</strong></div></div>
 {error&&<p role="alert" className="error">{error}</p>}
 <section className="pregame-crew"><h2><strong>{submitted} <span>OF</span> {players.length}</strong> CARDS SUBMITTED</h2><div>{players.map(p=><article key={p.participantId}><b>{p.submissionStatus==='SUBMITTED'?'✓':'○'} {p.displayName}</b><small>{p.attendance==='REMOTE'?'REMOTE · ':''}{p.submissionStatus==='SUBMITTED'?'Ready':`${p.completedSelections} / 15 picks`}</small></article>)}</div>{!players.length&&<p>The crew is assembling. Scan the code and claim your spot.</p>}</section>
 <section className="pregame-slate"><h2>Today’s slate</h2>{[...windows].sort((a,b)=>a[1].order-b[1].order).map(([window,group])=><section className="pregame-window" key={window}><h3>{window}</h3><div>{group.games.map(g=>{const props=view.configuration.propositions.filter(p=>p.gameId===g.id);const cats=[...new Set(view.configuration.slots.filter(s=>s.choices.some(ch=>ch.kind==='PROPOSITION_OUTCOME'&&props.some(p=>p.id===ch.propositionId))).map(s=>categories[s.category]))];const lines=props.flatMap(p=>p.parameters.kind==='AGAINST_SPREAD'?[`${p.parameters.favoredTeamId} ${p.parameters.spread>0?'+':''}${p.parameters.spread}`]:p.parameters.kind==='GAME_TOTAL'?[`Total ${p.parameters.total}`]:[]);return <article key={g.id}><strong>{g.awayTeamId} <span>at</span> {g.homeTeamId}</strong><small>{cats.join(' · ')}</small>{lines.length>0&&<p>{lines.join(' · ')}</p>}</article>})}</div></section>)}</section>
 <div className="pregame-bottom"><aside><span className="eyebrow">FROM THE CHEAP SEATS</span><p>{seconds===0?'Pencils down. The excuses start with the Reveal.':pending.length===1?`${pending[0]!.displayName} is keeping the suspense alive.`:pending.length>1?`${pending.length} cards still need a final answer. Confidence takes its time, apparently.`:players.length?'Everyone is in. Nobody can claim they weren’t ready.':'Good friends. Questionable predictions. Your name goes here.'}</p><small>Picks stay private until the Reveal finishes. Submitted cards can be edited until lock.</small></aside><section className="pregame-join">{seconds>0?<>{qrAvailable&&<a href={joinUrl}><img src={`/qr/${encodeURIComponent(id)}.png`} width="180" height="180" alt="Scan to join this contest"/></a>}<div><h2>{qrAvailable?'Scan to join':'Join the contest'}</h2><p>CODE <strong>{id}</strong></p><a href={joinUrl}>Open participant view ↗</a></div></>:<div><h2>Joining is closed</h2><a href={joinUrl}>Open participant view ↗</a></div>}</section></div></div>;
}
