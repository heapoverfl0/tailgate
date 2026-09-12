import {rankedTeam,rankedLabel} from './team-label';
import {PregameDisplay} from './PregameDisplay';
import { useEffect, useRef, useState } from 'react';
import {GameDay} from './GameDay';
import contestQr from './contest-qr.json';
import type { ContestConfiguration, PickCard, PickChoice } from '../../../packages/domain/src/index';

type Card = PickCard & { participantId: string; cardRevision: number; submissionStatus: string; validation: { complete: boolean } };
export type View = { contest: { name: string; lockAt: string; phase: string; lockedAt?: string }; configuration: ContestConfiguration; participants: { participantId: string; status: string; displayName: string; attendance: string; submissionStatus: string; completedSelections: number }[] };
class RequestError extends Error { constructor(public code: string, public details?: Card) { super(code.replaceAll('_', ' ').toLowerCase()); } }
export async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, { method, credentials: 'same-origin', headers: { 'content-type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(20000) });
  const data = await response.json();
  if (!response.ok) throw new RequestError(data.error?.code ?? 'REQUEST_FAILED', data.error?.details);
  return data;
}
const describe = (e: unknown) => e instanceof RequestError ? e.code==='INVALID_RECOVERY_CODE'?'That code is invalid, expired, or already used. Ask your commissioner for a new one.':e.message : 'Connection failed. Please try again.';
const categories = { CONFIDENCE: 'Confidence', ATS: 'Against the spread', UPSET_SPECIAL: 'Upset Special', MAIN_EVENT: 'Main Event' };

export function choiceLabel(choice: PickChoice, config: ContestConfiguration): string {
  if (choice.kind === 'NO_UPSET') return 'No upset — guaranteed 1 point';
  const parameters = config.propositions.find(p => p.id === choice.propositionId)?.parameters;
  let label = choice.outcome.kind === 'TEAM' ? choice.outcome.teamId : choice.outcome.kind === 'TOTAL_SIDE' ? choice.outcome.side : choice.outcome.kind === 'SCORE_TYPE' ? choice.outcome.scoreType.replaceAll('_', ' ') : 'Tie';
  if (parameters?.kind === 'AGAINST_SPREAD' && choice.outcome.kind === 'TEAM') {
    const spread = choice.outcome.teamId === parameters.favoredTeamId ? parameters.spread : -parameters.spread;
    label += ` ${spread > 0 ? '+' : ''}${spread}`;
  }
  if (parameters?.kind === 'GAME_TOTAL') label += ` ${parameters.total}`;
  return rankedLabel(label,config) + (choice.points ? ` · ${choice.points} pts` : '');
}

export function Contest({ id }: { id: string }) {
  const base = `/contests/${encodeURIComponent(id)}`;
  const [view, setView] = useState<View>();
  const [card, setCard] = useState<Card>();
  const [draft, setDraft] = useState<PickCard>({ picks: [] });
  const [dirty, setDirty] = useState(false);
  const [score, setScore] = useState({home: '', away: ''});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [name, setName] = useState('');
  const [recoveryCode,setRecoveryCode]=useState('');
  const [recoveryPlayer,setRecoveryPlayer]=useState('');
  const [issuedRecovery,setIssuedRecovery]=useState<{code:string;expiresAt:number;name:string}>();
  const [join, setJoin] = useState<{ requestId: string; requestSecret: string }>();
  const [admin, setAdmin] = useState(false);
  const [password, setPassword] = useState('');
  const [requests, setRequests] = useState<{ requestId: string; displayName: string }[]>([]);
  const [now, setNow] = useState(Date.now());
  const display = new URLSearchParams(location.search).get('display') === '1';
  const saving = useRef(false);
  const adopt = (next: Card) => { setCard(next); setDraft({ picks: next.picks, prediction: next.prediction }); setDirty(false); setScore({home: next.prediction ? String(next.prediction.home) : '', away: next.prediction ? String(next.prediction.away) : ''}); };
  useEffect(() => {
    let active = true;
    const load = async () => {
      try { const v = await api<View>(`${base}/pregame`); if (active) setView(v); }
      catch (e) { if (active) setError(describe(e)); }
    };
    void load();
    if (!display) {
      void api<Card>(`${base}/me/pick-card`).then(c => { if (active) adopt(c); }).catch(e => { if (!(e instanceof RequestError && ['UNAUTHENTICATED','FORBIDDEN'].includes(e.code)) && active) setError(describe(e)); });
      try { const stored = sessionStorage.getItem(`tailgate-join-${id}`); if (stored) setJoin(JSON.parse(stored)); } catch { /* Storage is optional. */ }
    }
    const timer = setInterval(load, 10000);
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => { active = false; clearInterval(timer); clearInterval(clock); };
  }, [base, display, id]);
  useEffect(() => {
    if (!join || card || display) return;
    let active = true;
    const poll = async () => {
      try {
        const result = await api<{status: string}>(`${base}/join-requests/${join.requestId}`, 'POST', { requestSecret: join.requestSecret });
        if (!active) return;
        if (result.status === 'APPROVED') {
          adopt(await api<Card>(`${base}/me/pick-card`)); setJoin(undefined); setMessage('You’re in. Make your picks.');
          try { sessionStorage.removeItem(`tailgate-join-${id}`); } catch { /* Optional storage. */ }
        } else if (result.status === 'DENIED') { setJoin(undefined); setError('Your request was declined. Contact your commissioner.'); try { sessionStorage.removeItem(`tailgate-join-${id}`); } catch {} }
      } catch (e) { if (active) setError(describe(e)); }
    };
    void poll(); const timer = setInterval(poll, 5000);
    return () => { active = false; clearInterval(timer); };
  }, [join, card, base, display, id]);
  useEffect(() => {
    if (!admin) return;
    const load = () => api<{requests: {requestId: string; displayName: string}[]}>(`${base}/join-requests`).then(r=>setRequests(r.requests)).catch(e=>setError(describe(e)));
    void load(); const timer = setInterval(load, 5000); return () => clearInterval(timer);
  }, [admin, base]);
  const locked = !!view && (view.contest.phase !== 'PREGAME' || !!view.contest.lockedAt || now >= Date.parse(view.contest.lockAt));
  const partialScore = (score.home === '') !== (score.away === '');
  const save = async () => {
    if (!card || !dirty || locked || partialScore || saving.current) return;
    saving.current = true; setBusy(true); setError('');
    try { adopt(await api<Card>(`${base}/me/pick-card`, 'PUT', { ...draft, expectedCardRevision: card.cardRevision })); setMessage('All changes saved.'); }
    catch (e) {
      if (e instanceof RequestError && e.code === 'CARD_REVISION_CONFLICT' && e.details) { adopt(e.details); setError('Your card changed in another tab. The latest saved card is shown; review it before editing.'); }
      else setError(describe(e));
    } finally { saving.current = false; setBusy(false); }
  };
  useEffect(() => { if (!dirty || busy || error || partialScore) return; const timer = setTimeout(save, 800); return () => clearTimeout(timer); }, [draft, dirty, busy, error, locked, partialScore]);
  useEffect(() => { const warn = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn); }, [dirty]);
  const change = (next: PickCard) => { setDraft(next); setDirty(true); setError(''); setMessage('Unsaved changes'); };
  const action = async (work: () => Promise<void>) => { setBusy(true); setError(''); try { await work(); } catch (e) { setError(describe(e)); } finally { setBusy(false); } };
  if (!view) return <main><a href="/">← All contests</a><h1>{error ? 'Couldn’t open this contest.' : 'Opening your contest…'}</h1>{error && <p role="alert" className="error">{error}</p>}<button onClick={()=>location.reload()}>Try again</button></main>;
  if(display&&['LIVE','MAIN_EVENT','FINAL'].includes(view.contest.phase))return <main className="display live-shell"><GameDay id={id} config={view.configuration} admin={false} shared/></main>;
  const joinUrl = new URL(`/?contest=${encodeURIComponent(id)}`, location.origin).href;
  const qrAvailable = (contestQr as Record<string,string>)[id] === joinUrl;
  if(display&&view.contest.phase==='PREGAME')return <main className="display live-shell"><PregameDisplay id={id} view={view} now={now} joinUrl={joinUrl} qrAvailable={qrAvailable} error={error}/></main>;
  const confidenceSlots = view.configuration.slots.filter(s => s.category === 'CONFIDENCE');
  const confidenceOwner = (n: number) => confidenceSlots.find(s => draft.picks.some(p => p.slotId === s.id && p.confidence === n));
  const availableConfidence = [1,2,3,4,5,6].filter(n => !confidenceOwner(n));
  const minutes = Math.max(0, Math.ceil((Date.parse(view.contest.lockAt) - now) / 60000));
  return <main className={display ? 'display' : ['MAIN_EVENT','FINAL'].includes(view.contest.phase)?'main-event-page':''}><div className="eyebrow">{locked ? 'PICKS CLOSED' : `LOCKS IN ${Math.floor(minutes/60)}H ${minutes%60}M`} · {id}</div><h1>{view.contest.name}</h1><p className="intro">{locked ? (['LIVE','MAIN_EVENT','FINAL'].includes(view.contest.phase) ? 'Picks are public. Follow the standings below.' : 'Your card is frozen. Picks remain private until the reveal.') : 'Your picks stay private. Submit when complete; edit until lock.'}</p>
    <nav><a href={`/?contest=${encodeURIComponent(id)}${display ? '' : '&display=1'}`}>{display ? 'Participant view' : 'Shared display ↗'}</a></nav>
    {display && !locked && <section className="join-display" aria-label="Join this contest">
      {qrAvailable && <a href={joinUrl} aria-label="Open this contest to join"><img src={`/qr/${encodeURIComponent(id)}.png`} alt={`QR code to join contest ${id}`} width="300" height="300" /></a>}
      <div><h2>{qrAvailable ? 'Scan to join' : 'Join this contest'}</h2><p>{qrAvailable ? 'Open your camera, scan the code, and request to join.' : 'Open the link below and request to join.'}</p><p>Contest code: <strong>{id}</strong></p><a href={joinUrl}>{joinUrl}</a></div>
    </section>}
    {error && <p className="error" role="alert">{error}</p>}{message && <p className="notice" role="status">{message}</p>}
    {!['MAIN_EVENT','FINAL'].includes(view.contest.phase)&&<section className="players"><h2>The crew <small>{view.participants.length} playing</small></h2>{view.participants.length === 0 ? <p>No players yet. Be the first to make a questionable prediction.</p> : view.participants.map(p=><article key={p.participantId}><strong>{p.displayName}</strong><span>{p.attendance === 'REMOTE' ? 'Remote' : 'On site'}</span><b>{p.submissionStatus === 'SUBMITTED' ? 'Submitted' : `${p.completedSelections} / 15 picks`}</b></article>)}</section>}
    {!display && !card && <section className="entry"><h2>Get in the game</h2>{join ? <p role="status">Waiting for commissioner approval. Keep this tab open.</p> : locked ? <p>This contest is closed to new players.</p> : <form onSubmit={e=>{e.preventDefault(); void action(async()=>{const r=await api<{requestId:string;requestSecret:string}>(`${base}/join-requests`,'POST',{displayName:name});setJoin(r);try{sessionStorage.setItem(`tailgate-join-${id}`,JSON.stringify(r));}catch{}});}}><label htmlFor="name">Your name</label><div className="inline"><input id="name" required maxLength={80} value={name} onChange={e=>setName(e.target.value)}/><button disabled={busy}>Request to join</button></div></form>}</section>}
    {!display && !card && <details className="entry"><summary>Already joined? Recover your picks</summary><p>Ask your commissioner for a recovery code. It restores your existing card and signs out your older sessions. Locked picks stay locked.</p><form onSubmit={e=>{e.preventDefault();void action(async()=>{await api(`${base}/recover`,'POST',{code:recoveryCode.trim()});setRecoveryCode('');setJoin(undefined);try{sessionStorage.removeItem(`tailgate-join-${id}`);}catch{}adopt(await api<Card>(`${base}/me/pick-card`));setMessage('Your saved card is restored.');});}}><label>Recovery code<input required autoComplete="off" autoCapitalize="none" spellCheck={false} value={recoveryCode} onChange={e=>setRecoveryCode(e.target.value)}/></label><button disabled={busy}>Restore my card</button></form></details>}
    <GameDay id={id} config={view.configuration} admin={admin} participantId={card?.participantId}/>
    {!display && card && !['MAIN_EVENT','FINAL'].includes(view.contest.phase) && <section className="pick-card"><h2>Your card <small>{card.submissionStatus === 'SUBMITTED' ? 'Submitted' : 'Draft'}</small></h2>
      {Object.entries(categories).map(([category,label])=><fieldset key={category} disabled={busy || locked}><legend>{label}</legend>{category==='CONFIDENCE' && <><p>Pick straight-up winners. Use each confidence value from 1 to 6 once. Six is your strongest pick.</p><p role="status"><strong>Available: {availableConfidence.length ? availableConfidence.join(', ') : 'All values assigned'}</strong></p>{card.submissionStatus==='SUBMITTED' && <p>Choose a used value to swap it with that game and keep your submitted card complete.</p>}</>}{view.configuration.slots.filter(s=>s.category===category).map(slot=>{
        const pick=draft.picks.find(p=>p.slotId===slot.id);
        const update=(choiceId:string, confidence=pick?.confidence)=>change({...draft,picks:[...draft.picks.filter(p=>p.slotId!==slot.id),...(choiceId?[{slotId:slot.id,choiceId,...(confidence?{confidence}: {})}]:[])]});
        return <div className="pick" key={slot.id}><label htmlFor={slot.id}>{rankedLabel(slot.label,view.configuration)}</label><div className="inline"><select id={slot.id} value={pick?.choiceId??''} onChange={e=>update(e.target.value)}><option value="" disabled={card.submissionStatus==='SUBMITTED'}>Choose your pick</option>{slot.choices.map(choice=><option key={choice.id} value={choice.id}>{choiceLabel(choice, view.configuration)}</option>)}</select>{category==='CONFIDENCE'&&<select aria-label={`${slot.label} confidence`} value={pick?.confidence??''} disabled={!pick} onChange={e=>{
          const confidence=Number(e.target.value) as 1|2|3|4|5|6;
          const owner=confidenceOwner(confidence);
          if (owner && owner.id!==slot.id && card.submissionStatus==='SUBMITTED') {
            change({...draft,picks:draft.picks.map(p=>p.slotId===slot.id?{...p,confidence}:p.slotId===owner.id?{...p,confidence:pick!.confidence}:p)});
          } else update(pick!.choiceId,confidence);
        }}><option value="" disabled={card.submissionStatus==='SUBMITTED'}>{pick?.confidence?'Clear confidence':'Confidence'}</option>{[1,2,3,4,5,6].map(n=>{
          const owner=confidenceOwner(n);
          const used=owner && owner.id!==slot.id;
          return <option key={n} value={n} disabled={!!used && card.submissionStatus!=='SUBMITTED'}>{n}{used?` — ${card.submissionStatus==='SUBMITTED'?'swap with':'used on'} ${owner.label}`:n===6?' — highest':''}</option>;
        })}</select>}</div></div>;
      })}</fieldset>)}
      <fieldset disabled={busy||locked}><legend>Final score tiebreaker</legend><p>Predict the Main Event score.</p><div className="inline">{(['home','away'] as const).map(side=><label key={side}>{view.configuration.games.find(g=>g.id===view.configuration.mainEventGameId)?.[side==='home'?'homeTeamId':'awayTeamId']}<input type="number" min={0} max={200} value={score[side]} onChange={e=>{const next={...score,[side]:e.target.value};setScore(next);change({...draft,prediction:next.home!==''&&next.away!==''?{home:Number(next.home),away:Number(next.away)}:undefined});}}/></label>)}</div></fieldset>
      {partialScore && <p role="status">Enter both final scores before saving.</p>}<div className="submit-bar"><span role="status">{locked?'Picks locked':busy?'Saving…':dirty?'Unsaved changes':card.submissionStatus==='SUBMITTED'?'Submitted · editable until lock':'Saved as draft'}</span><button disabled={busy||locked||!dirty||partialScore} onClick={()=>void save()}>Save changes</button><button disabled={busy||locked||dirty||!card.validation.complete||card.submissionStatus==='SUBMITTED'} onClick={()=>void action(async()=>{adopt(await api<Card>(`${base}/me/submit`,'POST',{expectedCardRevision:card.cardRevision}));setMessage('Card submitted. You can still edit until lock.');})}>Submit card</button></div>
    </section>}
    {!display && <details className="commissioner"><summary>Commissioner</summary><p><a href="/commissioner-runbook.html" target="_blank" rel="noopener">Open commissioner runbook ↗</a> · Game-day steps and troubleshooting</p>{!admin?<form onSubmit={e=>{e.preventDefault();void action(async()=>{await api('/commissioner/login','POST',{password});setPassword('');setAdmin(true);});}}><label htmlFor="password">Commissioner password</label><div className="inline"><input id="password" type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/><button disabled={busy}>Sign in</button></div></form>:<><h2>Restore player access</h2><p>Confirm who is requesting access before generating a code. Share it privately with that player; it expires in 15 minutes and works once. A new code replaces their previous code.</p><form onSubmit={e=>{e.preventDefault();void action(async()=>{const r=await api<{code:string;expiresAt:number}>(`${base}/recovery-code`,'POST',{participantId:recoveryPlayer});setIssuedRecovery({...r,name:view.participants.find(p=>p.participantId===recoveryPlayer)!.displayName});});}}><label>Existing player<select required value={recoveryPlayer} onChange={e=>{setRecoveryPlayer(e.target.value);setIssuedRecovery(undefined);}}><option value="">Choose a player</option>{view.participants.filter(p=>p.status==='ACTIVE').map(p=><option key={p.participantId} value={p.participantId}>{p.displayName}</option>)}</select></label><button disabled={busy||!recoveryPlayer}>Generate recovery code</button></form>{issuedRecovery&&<div role="status"><p>Code for {issuedRecovery.name}. Expires at {new Date(issuedRecovery.expiresAt).toLocaleTimeString()}.</p><label>One-use recovery code<textarea readOnly value={issuedRecovery.code} onFocus={e=>e.target.select()}/></label><button onClick={()=>setIssuedRecovery(undefined)}>Hide code</button></div>}<h2>Join requests</h2>{!requests.length?<p>No pending requests.</p>:requests.map(r=><article className="approval" key={r.requestId}><strong>{r.displayName}</strong>{['ON_SITE','REMOTE','DENY'].map(attendance=><button disabled={busy||locked} key={attendance} onClick={()=>void action(async()=>{await api(`${base}/join-requests/${r.requestId}/${attendance==='DENY'?'deny':'approve'}`,'POST',attendance==='DENY'?{}:{attendance});setRequests(rs=>rs.filter(x=>x.requestId!==r.requestId));setView(await api<View>(`${base}/pregame`));})}>{attendance==='DENY'?'Decline':attendance==='REMOTE'?'Approve remote':'Approve on site'}</button>)}</article>)}</>}</details>}
  </main>;
}
