import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
import { Contest } from './Contest';
function App() {
  const [code, setCode] = useState('');
  const contest = new URLSearchParams(location.search).get('contest');
  return <><header><a className="brand" href="/">TAILGATE<span>PICK ’EM</span></a><span className="eyebrow">SATURDAYS ARE PERSONAL.</span></header>{contest ? <Contest key={contest} id={contest}/> : <main><div className="eyebrow">THE PREGAME STARTS HERE</div><h1>Tailgate Pick’em</h1><p className="intro">Find your contest, fill your card, and keep your genius to yourself until the reveal.</p><form className="entry" onSubmit={e => {e.preventDefault(); location.assign(`/?contest=${encodeURIComponent(code.trim())}`);}}><label htmlFor="code">Contest code</label><div className="inline"><input id="code" required maxLength={80} pattern="[a-zA-Z0-9][a-zA-Z0-9_-]*" placeholder="Enter the code from your commissioner" value={code} onChange={e=>setCode(e.target.value)}/><button>Open contest →</button></div></form><section className="rules"><article><b>01 / MAKE YOUR CALL</b><p>Confidence. Against the spread. Upset Special. Main Event.</p></article><article><b>02 / KEEP IT QUIET</b><p>Your picks stay private. Submit when complete; edit until lock.</p></article><article><b>03 / SETTLE IT SATURDAY</b><p>One card. Plenty of opinions. Let the games do the talking.</p></article></section></main>}<footer>TAILGATE PICK ’EM <span>Good friends. Questionable predictions.</span></footer></>;
}
createRoot(document.getElementById('root')!).render(<App/>);
