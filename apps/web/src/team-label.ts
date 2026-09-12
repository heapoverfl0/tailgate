import snapshot from './ap-rankings.json';
import type {ContestConfiguration} from '../../../packages/domain/src/index';
export function rankedTeam(team:string,config:ContestConfiguration):string {
 const rank=snapshot.contestIds.includes(config.contestId)?(snapshot.ranks as Record<string,number>)[team]:undefined;
 return rank?`#${rank} ${team}`:team;
}
export function rankedLabel(text:string,config:ContestConfiguration):string {
 const teams=[...new Set(config.games.flatMap(g=>[g.homeTeamId,g.awayTeamId]))].sort((a,b)=>b.length-a.length);
 const escaped=teams.map(t=>t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
 return text.replace(new RegExp(`\\b(${escaped.join('|')})\\b`,'g'),team=>rankedTeam(team,config));
}
