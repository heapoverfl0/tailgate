import { createHash, timingSafeEqual } from 'node:crypto';
import { changeDay, prepareCardSave, type Contest, type ContestConfiguration, type ContestParticipant } from '../../domain/src/index.js';
import type { Store, StoredContest, JoinRequest, ParticipantSession } from './store.js';
export class RepositoryError extends Error {
  constructor(readonly code: string, readonly canonical?: unknown) { super(code); }
}
export interface CardWrite { contestId: string; participantId: string; expectedCardRevision: number; card?: unknown; submit?: boolean }
export interface Repository {
  updateDay(id: string, expectedVersion: number, action: string, body: Record<string,unknown>): Promise<StoredContest>;
  createContest(contest: Contest, config: ContestConfiguration): Promise<void>;
  getSnapshot(id: string): Promise<StoredContest>;
  createJoin(request: JoinRequest): Promise<void>;
  listJoins(contestId: string): Promise<JoinRequest[]>;
  getJoin(contestId: string, requestId: string): Promise<JoinRequest>;
  decideJoin(contestId: string, requestId: string, participant?: ContestParticipant): Promise<void>;
  exchangeJoin(contestId: string, requestId: string, secret: string, token: string, session: ParticipantSession): Promise<void>;
  resolveSession(token: string, contestId: string): Promise<ParticipantSession | undefined>;
  savePickCard(input: CardWrite): Promise<StoredContest>;
}
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
export function verifyJoinSecret(secret: string, expected: string): void {
  if (!timingSafeEqual(Buffer.from(hashToken(hashToken(secret))), Buffer.from(hashToken(expected)))) throw new RepositoryError('UNAUTHENTICATED');
}
// Hash both operands to fixed lengths, including malformed persisted values.
export function assertOpen(c: StoredContest, now: Date): void {
  if (c.contest.lockedAt || c.contest.phase !== 'PREGAME' || now.getTime() >= Date.parse(c.contest.lockAt)) throw new RepositoryError('LOCKED');
}
const own = <T>(map: Record<string, T>, key: string): T | undefined => Object.hasOwn(map, key) ? map[key] : undefined;
export class StoreRepository implements Repository {
  constructor(private readonly store: Store, private readonly now: () => Date = () => new Date()) {}
  private contest(state: Awaited<ReturnType<Store['read']>>, id: string) { const c = own(state.contests, id); if (!c) throw new RepositoryError('NOT_FOUND'); return c; }
  async getSnapshot(id: string) { return this.contest(await this.store.read(), id); }
  async createContest(contest: Contest, configuration: ContestConfiguration) {
    await this.store.transact(s => { if (own(s.contests, contest.id)) throw new RepositoryError('CONTEST_EXISTS');
      if (Date.parse(contest.lockAt) <= this.now().getTime()) throw new RepositoryError('LOCKED');
      s.contests[contest.id] = { contest, configuration, participants: {}, cards: {} };
    });
  }
  async updateDay(id: string, expectedVersion: number, action: string, body: Record<string,unknown>) {
    return this.store.transact(state=>{
      const c=this.contest(state,id);
      if(c.contest.version!==expectedVersion) throw new RepositoryError('CONTEST_VERSION_CONFLICT');
      const at=this.now().toISOString();
      changeDay(c,action,body,at);c.contest.version++;
      if(action!=='provider')(c.dayAudit??=[]).push({at,action,body:structuredClone(body)});return c;
    });
  }
  async listJoins(id: string) { const s = await this.store.read(); this.contest(s, id); return Object.values(s.joins).filter(j => j.contestId === id); }
  async getJoin(id: string, requestId: string) { const s = await this.store.read(); const j = own(s.joins, requestId); if (!j || j.contestId !== id) throw new RepositoryError('NOT_FOUND'); return j; }
  async createJoin(request: JoinRequest) {
    await this.store.transact(s => { const c = this.contest(s, request.contestId); assertOpen(c, this.now());
      if (Object.values(s.joins).filter(j => j.contestId === request.contestId && j.status === 'PENDING').length >= 100) throw new RepositoryError('TOO_MANY_REQUESTS');
      if (own(s.joins, request.id)) throw new RepositoryError('JOIN_ALREADY_HANDLED');
      s.joins[request.id] = request; c.contest.version++;
    });
  }
  async decideJoin(id: string, requestId: string, p?: ContestParticipant) {
    await this.store.transact(s => { const c = this.contest(s, id); assertOpen(c, this.now()); const j = own(s.joins, requestId);
      if (!j || j.contestId !== id) throw new RepositoryError('NOT_FOUND');
      if (j.status !== 'PENDING') throw new RepositoryError('JOIN_ALREADY_HANDLED');
      j.status = p ? 'APPROVED' : 'DENIED';
      if (p) { j.participantId = p.participantId; c.participants[p.participantId] = p; c.cards[p.participantId] = { picks: [] }; }
      c.contest.version++;
    });
  }
  async exchangeJoin(id: string, requestId: string, secret: string, token: string, session: ParticipantSession) {
    await this.store.transact(s => { const c = this.contest(s, id); assertOpen(c, this.now()); const j = own(s.joins, requestId);
      if (!j || j.contestId !== id) throw new RepositoryError('NOT_FOUND'); verifyJoinSecret(secret, j.secretHash);
      if (j.status !== 'APPROVED') throw new RepositoryError('JOIN_ALREADY_HANDLED');
      if (session.contestId !== id || session.participantId !== j.participantId || own(c.participants, session.participantId)?.status !== 'ACTIVE' || session.expiresAt <= this.now().getTime()) throw new RepositoryError('FORBIDDEN');
      s.sessions[hashToken(token)] = session; j.status = 'EXCHANGED'; c.contest.version++;
    });
  }
  async resolveSession(token: string, id: string) {
    const s = await this.store.read(); const session = own(s.sessions, hashToken(token));
    if (!session || session.expiresAt <= this.now().getTime()) return undefined;
    if (session.contestId !== id) throw new RepositoryError('FORBIDDEN');
    if (own(this.contest(s, id).participants, session.participantId)?.status !== 'ACTIVE') throw new RepositoryError('FORBIDDEN');
    return session;
  }
  async savePickCard(input: CardWrite) {
    return this.store.transact(s => { const c = this.contest(s, input.contestId); const p = own(c.participants, input.participantId);
      if (!p || p.status !== 'ACTIVE') throw new RepositoryError('FORBIDDEN');
      const before = c.cards[p.participantId]!; const at = this.now().toISOString();
      let saved;
      try { saved = prepareCardSave(c.configuration, c.contest, p, input.submit ? before : input.card, input.expectedCardRevision, at, input.submit); }
      catch (e) { throw new RepositoryError((e as Error).message, { participant: p, card: before }); }
      p.cardRevision++; p.submissionStatus = saved.submissionStatus; p.lastEditedBy = 'PARTICIPANT'; p.lastEditedAt = at;
      if (input.submit) p.submittedAt = at;
      s.history.push({ contestId: input.contestId, participantId: p.participantId, revision: p.cardRevision, at, editedBy: 'PARTICIPANT', before, after: saved.card });
      c.cards[p.participantId] = saved.card; c.contest.version++; return c;
    });
  }
}
