import test from 'node:test';
import assert from 'node:assert/strict';
import { freezeConfiguration, validateConfiguration, validateCard, prepareCardSave, scoreCard, champions, upsetPoints,
  type ContestConfiguration, type PropositionParameters, type PickSlot, type PickCard, type Resolution, type Contest, type ContestParticipant } from './index.js';

import { fixture } from './fixture.js';
const contest: Contest = { id: 'week', name: 'Week', timezone: 'America/Chicago', lockAt: '2026-09-12T16:00:00Z', phase: 'PREGAME', version: 10 };
const participant: ContestParticipant = { contestId: 'week', participantId: 'p', playerId: 'player', displayName: 'Player', attendance: 'REMOTE', status: 'ACTIVE', cardRevision: 2, submissionStatus: 'DRAFT' };
const before = '2026-09-12T15:00:00Z';

test('valid slate supports regular-category overlap and a complete 15-pick card', () => {
  const { c, card } = fixture();
  const v = validateCard(freezeConfiguration(c), card);
  assert.equal(v.complete, true); assert.equal(v.validSelections.length, 15);
});
test('empty drafts and winner-only drafts remain valid but incomplete', () => {
  const { c } = fixture();
  for (const card of [{ picks: [] }, { picks: [{ slotId: 'c1', choiceId: 'c1-0' }] }]) {
    const v = validateCard(c, card); assert.equal(v.valid, true); assert.equal(v.complete, false); assert.equal(v.validSelections.length, 0);
  }
});
test('unknown/malformed choices and duplicate slots are rejected', () => {
  const { c } = fixture();
  for (const card of [null, {}, { picks: [null] }, { picks: [{ slotId: 'bogus', choiceId: 'x' }] },
    { picks: [{ slotId: 'a1', choiceId: 'a2-0' }] }, { picks: [{ slotId: 'a1', choiceId: 'a1-0' }, { slotId: 'a1', choiceId: 'a1-1' }] }]) assert.equal(validateCard(c, card).valid, false);
});
test('confidence must be unique integers 1–6 and only occurs on confidence slots', () => {
  const { c, card } = fixture();
  for (const value of [0,7,1.5,NaN,'6']) {
    const input = structuredClone(card) as unknown as { picks: Record<string, unknown>[] };
    input.picks[0]!.confidence = value; assert.equal(validateCard(c, input).valid, false);
  }
  card.picks[1]!.confidence = 1;
  const v = validateCard(c, card); assert.equal(v.valid, false); assert.equal(v.validSelections.length, 13);
  assert.deepEqual(v.missingSlotIds, ['c1','c2']);
  assert.equal(validateCard(c, { picks: [{ slotId: 'a1', choiceId: 'a1-0', confidence: 1 }] }).valid, false);
});
test('submission requires prediction as well as complete selections', () => {
  const { c, card } = fixture(); delete card.prediction;
  assert.equal(validateCard(c, card).complete, false);
  assert.throws(() => prepareCardSave(c, contest, participant, card, 2, before, true), /INVALID_CARD/);
  card.prediction = { home: -1, away: 0 }; assert.equal(validateCard(c, card).valid, false);
});
test('Submit is explicit, permits later complete edits and rejects clearing submitted cards', () => {
  const { c, card } = fixture();
  assert.equal(prepareCardSave(c, contest, participant, card, 2, before).submissionStatus, 'DRAFT');
  assert.equal(prepareCardSave(c, contest, participant, card, 2, before, true).submissionStatus, 'SUBMITTED');
  const submitted = { ...participant, submissionStatus: 'SUBMITTED' as const };
  assert.equal(prepareCardSave(c, contest, submitted, card, 2, before).submissionStatus, 'SUBMITTED');
  assert.throws(() => prepareCardSave(c, contest, submitted, { picks: [] }, 2, before), /INVALID_CARD/);
});
test('save guard checks inclusive lock, early lock, participant scope and card revision independently of contest version', () => {
  const { c, card } = fixture();
  assert.throws(() => prepareCardSave(c, contest, participant, card, 2, contest.lockAt), /LOCKED/);
  assert.throws(() => prepareCardSave(c, { ...contest, lockedAt: before }, participant, card, 2, before), /LOCKED/);
  assert.throws(() => prepareCardSave(c, contest, participant, card, 1, before), /CONFLICT/);
  assert.throws(() => prepareCardSave(c, contest, { ...participant, contestId: 'other' }, card, 2, before), /FORBIDDEN/);
  assert.doesNotThrow(() => prepareCardSave(c, { ...contest, version: 999 }, participant, card, 2, before));
});
test('save detaches participant input and strips client-supplied grading', () => {
  const { c, card } = fixture();
  const input = { ...card, picks: card.picks.map(p => ({ ...p, pointsAwarded: 999 })) };
  const saved = prepareCardSave(c, contest, participant, input, 2, before).card;
  input.picks[0]!.choiceId = 'bad'; assert.equal(saved.picks[0]!.choiceId, 'c1-1');
  assert.equal('pointsAwarded' in saved.picks[0]!, false);
});
test('perfect feasible card scores 38; attendance is absent from scoring inputs', () => {
  const { c, card, results } = fixture(); assert.equal(scoreCard(c, card, results).points, 38);
});
test('NO_UPSET banks one even with all football propositions unresolved or void', () => {
  const { c } = fixture(); const card = { picks: [{ slotId: 'upset', choiceId: 'coward' }] };
  assert.equal(scoreCard(c, card, {}).points, 1);
  assert.equal(scoreCard(c, card, Object.fromEntries(c.propositions.map(p => [p.id, { status: 'VOID' }]))).points, 1);
});
test('missing picks score zero while valid picks on an incomplete card score normally', () => {
  const { c, card, results } = fixture(); card.picks = card.picks.filter(p => p.slotId !== 'upset');
  assert.equal(scoreCard(c, card, results).points, 32);
  assert.equal(scoreCard(c, { picks: [] }, results).points, 0);
});
test('all duplicate confidence pairings score zero, not the entire card', () => {
  const { c, card, results } = fixture(); card.picks[1]!.confidence = 1;
  assert.equal(scoreCard(c, card, results).points, 35);
});
test('ATS pushes score one; voids and losses score zero; unresolved picks do not bank', () => {
  const { c, card, results } = fixture();
  results.a1 = { status: 'PUSH' }; results.a2 = { status: 'VOID' }; results.a3 = { status: 'RESOLVED', outcome: { kind: 'TEAM', teamId: 'g3-away' } };
  results.winner = { status: 'UNRESOLVED' };
  assert.equal(scoreCard(c, card, results).points, 32);
});
test('resolved early Main Event propositions bank immediately and source corrections recalculate', () => {
  const { c, card } = fixture();
  const results: Record<string, Resolution> = { first: { status: 'RESOLVED', outcome: { kind: 'TEAM', teamId: 'main-home' } } };
  assert.equal(scoreCard(c, card, results).points, 1);
  results.first = { status: 'RESOLVED', outcome: { kind: 'TEAM', teamId: 'main-away' } };
  assert.equal(scoreCard(c, card, results).points, 0);
});
test('invalid outcomes and unspecified non-ATS pushes cannot silently award points', () => {
  const { c, card } = fixture();
  assert.throws(() => scoreCard(c, card, { total: { status: 'PUSH' } }), /Only ATS/);
  assert.throws(() => scoreCard(c, card, { first: { status: 'RESOLVED', outcome: { kind: 'TEAM', teamId: 'alien' } } }), /Invalid resolved/);
});
test('frozen lines, odds, choices and point values cannot be mutated through source or snapshot', () => {
  const { c, card, results } = fixture(); const frozen = freezeConfiguration(c);
  c.slots[9]!.choices[0]!.points = 2;
  assert.equal(scoreCard(frozen, card, results).points, 38);
  assert.throws(() => { (frozen as ContestConfiguration).slots[9]!.choices[0]!.points = 2; }, TypeError);
  assert.throws(() => { const params = (frozen as ContestConfiguration).propositions[6]!.parameters; if (params.kind === 'AGAINST_SPREAD') params.spread = -7; }, TypeError);
});
test('configuration rejects Main Event overlap, missing options and inconsistent question types', () => {
  const { c } = fixture();
  const overlap = structuredClone(c); overlap.mainEventGameId = 'g1'; assert.throws(() => validateConfiguration(overlap), /exclusive/);
  const missing = structuredClone(c); missing.slots[0]!.choices.pop(); assert.throws(() => validateConfiguration(missing), /every outcome/);
  const type = structuredClone(c); type.propositions[0]!.type = 'GAME_TOTAL'; assert.throws(() => validateConfiguration(type), /mismatch/);
  const duplicate = structuredClone(c); duplicate.slots[1]!.choices = structuredClone(duplicate.slots[0]!.choices); assert.throws(() => validateConfiguration(duplicate), /unique/);
});
test('working upset tiers have exact boundary behavior; invalid odds rejected', () => {
  for (const [line, points] of [[100,2],[199,2],[200,3],[299,3],[300,4],[449,4],[450,5],[699,5],[700,6],[1500,6]]) assert.equal(upsetPoints(line!), points);
  for (const line of [-100,99,NaN,100.5]) assert.throws(() => upsetPoints(line));
});
test('first place uses points then team-specific score error; remaining ties share championship', () => {
  const entries = [{ participantId: 'a', points: 30, prediction: { home: 31, away: 27 } }, { participantId: 'b', points: 30, prediction: { home: 28, away: 30 } }, { participantId: 'c', points: 29, prediction: { home: 28, away: 30 } }];
  assert.deepEqual(champions(entries, { home: 28, away: 30 }), ['b']);
  assert.deepEqual(champions(entries), ['a','b']);
  assert.deepEqual(champions(entries, { home: 30, away: 29 }), ['a','b']);
  assert.deepEqual(champions([]), []);
});

test('malformed duplicate slot cannot preserve the other copy for scoring', () => {
  const { c, results } = fixture();
  const card = { picks: [{ slotId: 'a1', choiceId: 'a1-1' }, { slotId: 'a1' }] };
  assert.equal(scoreCard(c, card, results).points, 0);
});
test('invalid upset provenance, score overrides, slate counts and foreign contest data are rejected', () => {
  const { c } = fixture();
  const odds = structuredClone(c); const dog = odds.slots[9]!.choices[0]!;
  if (dog.kind === 'PROPOSITION_OUTCOME') delete dog.source;
  assert.throws(() => freezeConfiguration(odds), /provenance/);
  const override = structuredClone(c); override.slots[6]!.choices[0]!.points = 10;
  assert.throws(() => freezeConfiguration(override), /override/);
  const count = structuredClone(c); count.slots.pop(); assert.throws(() => freezeConfiguration(count), /15 slots/);
  const foreign = structuredClone(c); foreign.propositions[0]!.contestId = 'other'; assert.throws(() => freezeConfiguration(foreign), /mismatch/);
});
test('missing final-score prediction never beats a valid prediction when actual score exists', () => {
  assert.deepEqual(champions([{ participantId: 'a', points: 10 }, { participantId: 'b', points: 10, prediction: { home: 1, away: 1 } }], { home: 0, away: 0 }), ['b']);
  assert.deepEqual(champions([{ participantId: 'a', points: 10 }, { participantId: 'b', points: 10 }], { home: 0, away: 0 }), ['a','b']);
});

test('manual game facts resolve correlated outcomes and total ties void for everyone',async()=>{
 const {resolutions,parseGameFact}=await import('./game-day.js');
 const {c}=fixture();const total=c.propositions.find(p=>p.id==='total')!;total.parameters={kind:'GAME_TOTAL',total:58};
 const results=resolutions(c,{g1:{status:'FINAL',home:30,away:27},main:{status:'FINAL',home:31,away:27,firstTeam:'main-away',firstScore:'FIELD_GOAL',halftime:'TIE'}});
 assert.deepEqual(results.a1,{status:'PUSH'});assert.deepEqual(results.total,{status:'VOID'});
 assert.deepEqual(results.winner,{status:'RESOLVED',outcome:{kind:'TEAM',teamId:'main-home'}});
 assert.deepEqual(results.half,{status:'RESOLVED',outcome:{kind:'TIE'}});
 assert.throws(()=>parseGameFact(c,'main',{status:'FINAL',home:31}),/INVALID_RESULT/);
 assert.throws(()=>parseGameFact(c,'main',{status:'IN_PROGRESS',firstTeam:'main-home'}),/INVALID_RESULT/);
 assert.deepEqual(resolutions(c,{main:{status:'VOID'}}).total,{status:'VOID'});
});


test('live projection ignores scheduled games, banks NO_UPSET once, and projects ATS pushes',async()=>{
 const {liveProjection}=await import('./projections.js');const {resolutions}=await import('./game-day.js');const {c}=fixture();
 const card={picks:[{slotId:'a1',choiceId:'a1-0'},{slotId:'upset',choiceId:'coward'}]};
 assert.deepEqual(liveProjection(c,card,{},{}),{projectedPoints:1,remainingPoints:2});
 const games={g1:{status:'IN_PROGRESS' as const,home:10,away:7}};
 assert.deepEqual(liveProjection(c,card,resolutions(c,games),games),{projectedPoints:2,remainingPoints:2});
 games.g1.home=14;assert.equal(liveProjection(c,card,resolutions(c,games),games).projectedPoints,3);
 assert.deepEqual(liveProjection(c,card,{a1:{status:'VOID'}},games),{projectedPoints:1,remainingPoints:0});
});
test('resolved first score stays banked; missing live scores do not fabricate projections',async()=>{
 const {liveProjection}=await import('./projections.js');const {c,card}=fixture();
 const picks={picks:card.picks.filter(p=>['first','winner','total'].includes(p.slotId))};
 assert.deepEqual(liveProjection(c,picks,{first:{status:'RESOLVED',outcome:{kind:'TEAM',teamId:'main-home'}}},{main:{status:'IN_PROGRESS'}}),{projectedPoints:1,remainingPoints:2});
});
test('winning paths wait for earlier results, handle missing resolutions, and stop after resolution',async()=>{
 const {mainEventPaths}=await import('./projections.js');const {c,card,results}=fixture();const e=[{participantId:'p',points:0,picks:card.picks}];
 assert.equal(mainEventPaths(c,e,{}, {})[0]!.status,'PENDING_EARLIER_GAMES');
 assert.equal(mainEventPaths(c,e,results,{})[0]!.status,'RESOLVED');
});
test('winning paths honor actual score bounds and prediction tiebreaks including cochampions',async()=>{
 const {mainEventPaths}=await import('./projections.js');const {c,card,results}=fixture();results.first={status:'UNRESOLVED'};
 const entries=[{participantId:'a',points:20,picks:card.picks,prediction:{home:31,away:27}},{participantId:'b',points:20,picks:card.picks,prediction:{home:0,away:0}},{participantId:'c',points:20,picks:card.picks,prediction:{home:31,away:27}}];
 const paths=mainEventPaths(c,entries,results,{main:{status:'FINAL',home:31,away:27}});
 assert.deepEqual(paths.map(p=>p.status),['ALIVE','NO_PATH','ALIVE']);assert.equal(paths[0]!.example!.coChampion,true);assert.equal(paths[0]!.example!.home,31);
});
test('winning path example scores consistently with the authoritative resolver',async()=>{
 const {mainEventPaths}=await import('./projections.js');const {resolutions}=await import('./game-day.js');const {c,card,results}=fixture();
 for(const p of c.propositions.filter(p=>p.gameId==='main'))results[p.id]={status:'UNRESOLVED'};
 const points=scoreCard(c,card,results).points;const paths=mainEventPaths(c,[{participantId:'p',points,picks:card.picks,prediction:card.prediction}],results,{main:{status:'IN_PROGRESS',home:14,away:7,period:2}});
 const ex=paths[0]!.example!;assert.ok(ex.home>=14&&ex.away>=7);
 const simulated=resolutions(c,{main:{status:'FINAL',home:ex.home,away:ex.away,firstTeam:ex.firstTeam!,firstScore:ex.firstScore as 'TOUCHDOWN',halftime:ex.halftime!}});
 const merged={...results};for(const p of c.propositions.filter(p=>p.gameId==='main'))merged[p.id]=simulated[p.id]!;
 assert.equal(scoreCard(c,card,merged).points,ex.points);
});

test('missing halftime fact is not projected from a second-half lead',async()=>{
 const {liveProjection}=await import('./projections.js');const {c}=fixture();
 const card={picks:[{slotId:'half',choiceId:'half-0'}]};
 assert.deepEqual(liveProjection(c,card,{}, {main:{status:'IN_PROGRESS',home:21,away:7,period:3}}),{projectedPoints:0,remainingPoints:1});
 assert.equal(liveProjection(c,card,{}, {main:{status:'IN_PROGRESS',home:21,away:7,period:2}}).projectedPoints,1);
});


test('Reveal commentary only uses the current public step and never hidden selections',async()=>{
 const {revealCommentary}=await import('./commentary.js');const {revealView}=await import('./game-day.js');const {c,card}=fixture();
 const s={contest,configuration:c,participants:{p:participant},cards:{p:card},gameDay:{revealStep:0,games:{}}};
 const locked=revealCommentary(c,revealView(s));assert.equal(locked.id,'locked');
 card.picks=[];assert.deepEqual(revealCommentary(c,revealView(s)),locked);
 const {card:fresh}=fixture();s.cards.p=fresh;s.gameDay.revealStep=2;
 const wolf=revealCommentary(c,revealView(s));assert.match(wolf.text,/Player stands alone on g1-away/);
 fresh.picks.find(p=>p.slotId==='total')!.choiceId='total-1';assert.deepEqual(revealCommentary(c,revealView(s)),wolf);
 s.gameDay.revealStep=3;fresh.picks.find(p=>p.slotId==='upset')!.choiceId='coward';assert.equal(revealCommentary(c,revealView(s)).id,'cowards-point');
});
test('live commentary requires observed trailing scores, ignores clock-only changes, and distinguishes final champions',async()=>{
 const {standingsCommentary}=await import('./commentary.js');const {standings}=await import('./game-day.js');const {c,card}=fixture();
 const s={contest,configuration:c,participants:{p:participant,q:{...participant,participantId:'q',displayName:'Second'}},cards:{p:card,q:structuredClone(card)},gameDay:{revealStep:6,games:{g6:{status:'IN_PROGRESS' as const,home:7,away:14,clock:'08:00'}}}};
 const comment=()=>standingsCommentary(c,standings(s),s.gameDay.games,false)!;
 assert.match(comment().id,/six-trailing/);const before=comment();s.gameDay.games.g6.clock='07:59';assert.deepEqual(comment(),before);
 s.gameDay.games.g6.home=14;assert.equal(comment().id,'no-points');
 const board=standings(s);assert.match(standingsCommentary(c,board,s.gameDay.games,true)!.text,/share the championship/);
 board.champions=['p'];assert.match(standingsCommentary(c,board,s.gameDay.games,true)!.text,/Player wins/);
});


test('shared game exposure includes all categories and uses the authoritative score projection',async()=>{
 const {livePresentation}=await import('./live-presentation.js');const {standings}=await import('./game-day.js');const {c,card}=fixture();
 const s={contest,configuration:c,participants:{p:participant},cards:{p:card},gameDay:{revealStep:6,games:{g1:{status:'IN_PROGRESS' as const,home:7,away:10}}}};
 const presentation=livePresentation(c,standings(s),s.gameDay.games);assert.equal(presentation.featuredGameId,'g1');
 const g=presentation.games.find(g=>g.id==='g1')!;assert.deepEqual(g.categories,['CONFIDENCE','ATS','UPSET_SPECIAL']);assert.equal(g.players[0]!.projected,9);assert.equal(g.players[0]!.banked,0);assert.equal(g.players[0]!.picks.length,3);
 card.picks.find(p=>p.slotId==='upset')!.choiceId='coward';const next=livePresentation(c,standings(s),s.gameDay.games);assert.equal(next.games.find(g=>g.id==='g1')!.players[0]!.projected,3);
 assert.equal(next.games.find(g=>g.id==='main')!.fact,undefined);
});
