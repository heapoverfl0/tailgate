import { readFile, writeFile, rename, mkdir, unlink } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Contest, ContestConfiguration, ContestParticipant, PickCard, GameDay } from '../../domain/src/index.js';
export interface JoinRequest { id: string; contestId: string; name: string; secretHash: string; status: 'PENDING' | 'APPROVED' | 'DENIED' | 'EXCHANGED'; participantId?: string }
export interface Recovery { secretHash: string; expiresAt: number }
export interface ParticipantSession { sessionVersion?: number; contestId: string; participantId: string; expiresAt: number }
export interface StoredContest { recoveries?: Record<string, Recovery>; gameDay?: GameDay; dayAudit?: {at:string; action:string; body:Record<string,unknown>}[]; contest: Contest; configuration: ContestConfiguration; participants: Record<string, ContestParticipant>; cards: Record<string, PickCard> }
export interface Revision { contestId: string; participantId: string; revision: number; at: string; editedBy: 'PARTICIPANT'; before: PickCard; after: PickCard }
export interface StoreState { schemaVersion: 1; contests: Record<string, StoredContest>; joins: Record<string, JoinRequest>; sessions: Record<string, ParticipantSession>; history: Revision[] }
export interface Store { read(): Promise<StoreState>; transact<T>(change: (state: StoreState) => T): Promise<T> }
const empty = (): StoreState => ({ schemaVersion: 1, contests: {}, joins: {}, sessions: {}, history: [] });
export class MemoryStore implements Store {
  protected state: StoreState;
  private queue: Promise<void> = Promise.resolve();
  constructor(state = empty()) { this.state = structuredClone(state); }
  protected async persist(_next: StoreState): Promise<void> {}
  async read(): Promise<StoreState> { await this.queue; return structuredClone(this.state); }
  async transact<T>(change: (state: StoreState) => T): Promise<T> {
    const operation = this.queue.then(async () => {
      const next = structuredClone(this.state);
      const result = change(next);
      await this.persist(next);
      this.state = next;
      return structuredClone(result);
    });
    this.queue = operation.then(() => {}, () => {});
    return operation;
  }
}
// Single-process local adapter. One server owns this file; use DynamoDB transactions for deployment.
export class FileStore extends MemoryStore {
  private constructor(private readonly path: string, state: StoreState) { super(state); }
  static async open(path: string): Promise<FileStore> {
    let state = empty();
    try {
      state = JSON.parse(await readFile(path, 'utf8')) as StoreState;
      if (state.schemaVersion !== 1 || !state.contests || !state.joins || !state.sessions || !Array.isArray(state.history)) throw new Error('Unsupported store format');
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    return new FileStore(path, state);
  }
  protected override async persist(next: StoreState): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
    const temporary = `${this.path}.${randomUUID()}.tmp`;
    try { await writeFile(temporary, JSON.stringify(next), { mode: 0o600, flag: 'wx' }); await rename(temporary, this.path); }
    finally { await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
  }
}
