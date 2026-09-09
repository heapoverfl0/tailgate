import type { ContestSummary } from '../../contracts/src/index.js';
export interface ContestRepository { getSummary(id: string): Promise<ContestSummary | undefined> }
export class MemoryContestRepository implements ContestRepository {
  private readonly contests: Map<string, ContestSummary>;
  constructor(seed: readonly ContestSummary[] = []) { this.contests = new Map(seed.map(c => [c.id, { ...c }])); }
  async getSummary(id: string): Promise<ContestSummary | undefined> { const c = this.contests.get(id); return c ? { ...c } : undefined; }
}
export const demoContest: ContestSummary = { id: 'demo', title: 'Tailgate Pick’em — Demo', phase: 'PREGAME', version: 1 };
