import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from '../../../packages/domain/src/fixture.js';
import {StoreRepository} from '../../../packages/persistence/src/repository.js';
import {MemoryStore} from '../../../packages/persistence/src/store.js';
import {normalizeScoreboard,firstScore,type GameMapping} from '../../../packages/game-data/src/cfbd.js';
import {poll} from './index.js';
const m:GameMapping={gameId:'g1',externalId:1,homeId:10,awayId:20,homeTeamId:'g1-home',awayTeamId:'g1-away',startDate:'2026-09-12T16:00:00Z'};
const board=(mapping=m)=>({id:mapping.externalId,status:'completed',period:null,clock:null,homeTeam:{id:mapping.homeId,points:21,lineScores:[7,0,7,7]},awayTeam:{id:mapping.awayId,points:24,lineScores:[0,10,7,7]}});
test('CFBD mapping, missing scores, halftime and observed clock normalize without invented data',()=>{
 assert.deepEqual(normalizeScoreboard(board(),m),{status:'FINAL',home:21,away:24,halftime:'g1-away'});
 assert.throws(()=>normalizeScoreboard({...board(),id:2},m));
 const g=board();g.status='scheduled';assert.equal(normalizeScoreboard(g,m).home,undefined);
 assert.throws(()=>normalizeScoreboard({...board(),homeTeam:{id:10,points:null}},m));
 assert.equal(normalizeScoreboard({...board(),status:'in_progress',period:3,clock:'06:42'},m).clock,'06:42');
 assert.deepEqual(normalizeScoreboard({...board(),status:'postponed'},m),{status:'VOID'});
});
test('first score uses scoring team, not offensive possession; incomplete play feeds stay unresolved',()=>{
 const opening={id:'1',period:1,clock:'15:00',homeScore:0,awayScore:0,playType:'Kickoff'};
 const scoring={id:'2',period:1,clock:'14:00',homeScore:0,awayScore:6,teamId:10,playType:'Interception Return Touchdown'};
 assert.deepEqual(firstScore({id:1,drives:[{plays:[scoring,opening]}]},m),{firstTeam:'g1-away',firstScore:'TOUCHDOWN'});
 assert.deepEqual(firstScore({id:1,drives:[{plays:[scoring]}]},m),{});
 assert.deepEqual(firstScore({id:1,drives:[{plays:[opening,{...scoring,playType:'Unknown'}]}]},m),{});
});
test('poll persists provider facts separately, preserves overrides, skips unchanged data and never writes in dry-run',async()=>{
 const {c}=fixture();let time=new Date('2026-09-12T15:00:00Z');
 const repo=new StoreRepository(new MemoryStore(),()=>time);
 await repo.createContest({id:'week',name:'Test',timezone:'UTC',phase:'PREGAME',version:1,lockAt:'2026-09-12T16:00:00Z'},c);
 const mappings=c.games.map((g,i)=>({...m,gameId:g.id,externalId:i+1,homeId:i*10+10,awayId:i*10+11,homeTeamId:g.homeTeamId,awayTeamId:g.awayTeamId}));
 const client={get:async(path:string)=>path==='/scoreboard'?mappings.map(x=>board(x)):undefined};
 assert.equal((await poll(repo,client,'week',mappings,time)).status,'inactive');
 await poll(repo,client,'week',mappings,time,true);assert.equal((await repo.getSnapshot('week')).contest.version,1);
 time=new Date('2026-09-12T16:00:00Z');await poll(repo,client,'week',mappings,time);
 let s=await repo.getSnapshot('week');assert.equal(s.contest.phase,'REVEAL');assert.equal(s.gameDay?.games.g1?.home,21);
 const version=s.contest.version;await poll(repo,client,'week',mappings,time);assert.equal((await repo.getSnapshot('week')).contest.version,version);
 for(let i=0;i<6;i++){s=await repo.updateDay('week',s.contest.version,'advance',{});}
 s=await repo.updateDay('week',s.contest.version,'result',{gameId:'g1',fact:{status:'FINAL',home:40,away:0},reason:'Observed correction'});
 const changed={get:async(path:string)=>path==='/scoreboard'?mappings.map(x=>({...board(x),homeTeam:{...board(x).homeTeam,points:30}})):undefined};
 await poll(repo,changed,'week',mappings,time);s=await repo.getSnapshot('week');assert.equal(s.gameDay?.games.g1?.home,40);assert.equal(s.gameDay?.providerGames?.g1?.home,30);
 s=await repo.updateDay('week',s.contest.version,'clear-override',{gameId:'g1',reason:'Use provider again'});assert.equal(s.gameDay?.games.g1?.home,30);
});
