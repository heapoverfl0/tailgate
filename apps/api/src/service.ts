import { parseConfiguration } from './configuration-input.js';
import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type { StoredContest } from '../../../packages/persistence/src/store.js';
import { RepositoryError, assertOpen, verifyJoinSecret, type Repository } from '../../../packages/persistence/src/repository.js';
import { revealView, standings, validateCard, type Contest, type ContestConfiguration, type PickCard } from '../../../packages/domain/src/index.js';
export interface ApiRequest { method: string; path: string; body?: unknown; headers?: Record<string, string | undefined> }
export interface ApiResponse { statusCode: number; body: unknown; cookies?: string[] }
export interface ApiSettings { origin: string; password: string; signingSecret: string; secureCookies: boolean; now?: () => Date }
class ApiError extends Error { constructor(readonly status: number, readonly code: string, readonly details?: unknown) { super(code); } }
const fail = (status: number, code: string, details?: unknown): never => { throw new ApiError(status, code, details); };
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const matches = (a: string, b: string) => timingSafeEqual(Buffer.from(hash(a), 'hex'), Buffer.from(hash(b), 'hex'));
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const own = <T>(map: Record<string, T>, key: string): T | undefined => Object.hasOwn(map, key) ? map[key] : undefined;
const safeId = (v: unknown): v is string => typeof v === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(v) && !['__proto__','constructor','prototype'].includes(v);
function bodyObject(body: unknown): Record<string, unknown> { return object(body) ? body : fail(400, 'INVALID_REQUEST'); }
function cookie(headers: ApiRequest['headers'], name: string): string | undefined {
  return headers?.cookie?.split(';').map(s => s.trim()).find(s => s.startsWith(`${name}=`))?.slice(name.length + 1);
}
export function createService(repository: Repository, settings: ApiSettings) {
  if (!settings.password || settings.signingSecret.length < 32) throw new Error('Commissioner password and a signing secret of at least 32 characters are required');
  const origin = new URL(settings.origin);
  if (settings.secureCookies ? origin.protocol !== 'https:' : !['localhost','127.0.0.1','[::1]'].includes(origin.hostname)) throw new Error('Insecure cookies are restricted to loopback development');
  const now = settings.now ?? (() => new Date());
  const setCookie = (name: string, value: string, age: number) => `${name}=${value}; HttpOnly; SameSite=Lax; Path=/api; Max-Age=${age}${settings.secureCookies ? '; Secure' : ''}`;
  const signature = (payload: string) => createHmac('sha256', settings.signingSecret).update(payload).digest('base64url');
  const commissioner = (req: ApiRequest) => {
    const token = cookie(req.headers, 'tailgate_commissioner');
    if (!token) return fail(401, 'UNAUTHENTICATED');
    const parts = token.split('.');
    if (parts.length !== 2 || !matches(signature(parts[0]!), parts[1]!)) return fail(401, 'UNAUTHENTICATED');
    try {
      const payload = JSON.parse(Buffer.from(parts[0]!, 'base64url').toString()) as Record<string, unknown>;
      if (payload.role !== 'COMMISSIONER' || typeof payload.exp !== 'number' || payload.exp <= now().getTime() || payload.credentialVersion !== signature(settings.password)) return fail(401, 'UNAUTHENTICATED');
    } catch { return fail(401, 'UNAUTHENTICATED'); }
  };
  const participant = async (req: ApiRequest, contestId: string) => {
    const token = cookie(req.headers, 'tailgate_participant');
    const session = token ? await repository.resolveSession(token, contestId) : undefined;
    return session ?? fail(401, 'UNAUTHENTICATED');
  };
  const cardView = (c: StoredContest, participantId: string) => {
    const p = c.participants[participantId]!; const card = c.cards[participantId]!;
    const { complete, missingSlotIds, predictionMissing } = validateCard(c.configuration, card);
    return { ...card, contestVersion: c.contest.version, cardRevision: p.cardRevision, submissionStatus: p.submissionStatus, validation: { complete, missingSlotIds, predictionMissing } };
  };
  // Public read models only; a new persisted version always invalidates the entry.
  const boards=new Map<string,{version:number;board:ReturnType<typeof standings>}>();
  const boardFor=(snapshot:StoredContest)=>{
    if(snapshot.gameDay?.final)return snapshot.gameDay.final;
    const id=snapshot.contest.id;const cached=boards.get(id);
    if(cached?.version===snapshot.contest.version)return structuredClone(cached.board);
    const board=standings(snapshot);boards.delete(id);
    if(boards.size>=8)boards.delete(boards.keys().next().value!);
    boards.set(id,{version:snapshot.contest.version,board});return structuredClone(board);
  };
  const loginAttempts: number[] = [];
  return async (req: ApiRequest): Promise<ApiResponse> => {
    try {
      if (req.method !== 'GET' && req.headers?.origin !== origin.origin) return fail(403, 'ORIGIN_REJECTED');
      if (req.method === 'GET' && req.path === '/api/health') return { statusCode: 200, body: { status: 'ok' } };
      if (req.method === 'POST' && req.path === '/api/commissioner/login') {
        const body = bodyObject(req.body);
        while (loginAttempts.length && loginAttempts[0]! <= now().getTime() - 60_000) loginAttempts.shift();
        if (loginAttempts.length >= 10) return fail(429, 'TRY_LATER');
        loginAttempts.push(now().getTime());
        if (typeof body.password !== 'string' || !matches(body.password, settings.password)) return fail(401, 'INVALID_CREDENTIALS');
        const payload = Buffer.from(JSON.stringify({ role: 'COMMISSIONER', iat: now().getTime(), exp: now().getTime() + 30 * 86400000, credentialVersion: signature(settings.password) })).toString('base64url');
        return { statusCode: 200, body: { role: 'COMMISSIONER' }, cookies: [setCookie('tailgate_commissioner', `${payload}.${signature(payload)}`, 30 * 86400)] };
      }
      if (req.method === 'POST' && req.path === '/api/contests') {
        commissioner(req); const body = bodyObject(req.body);
        const c = bodyObject(body.contest); const config = bodyObject(body.configuration);
        if (!safeId(c.id) || typeof c.name !== 'string' || !c.name.trim() || c.name.length > 120 || typeof c.timezone !== 'string' || typeof c.lockAt !== 'string' || !Number.isFinite(Date.parse(c.lockAt)) || Date.parse(c.lockAt) <= now().getTime()) return fail(422, 'INVALID_CONTEST');
        try { new Intl.DateTimeFormat('en-US', { timeZone: c.timezone }); parseConfiguration(config); }
        catch { return fail(422, 'INVALID_CONFIGURATION'); }
        if (config.contestId !== c.id) return fail(422, 'INVALID_CONFIGURATION');
        const contest: Contest = { id: c.id, name: c.name.trim(), timezone: c.timezone, lockAt: c.lockAt, phase: 'PREGAME', version: 1 };
        await repository.createContest(contest, structuredClone(config) as unknown as ContestConfiguration);
        return { statusCode: 201, body: contest };
      }
      const route = /^\/api\/contests\/([a-zA-Z0-9_-]+)(?:\/(.*))?$/.exec(req.path);
      if (!route || !safeId(route[1])) return fail(404, 'NOT_FOUND');
      const id = route[1]!; const action = route[2] ?? '';
      if(action.startsWith('me/')) await participant(req,id);
      if(req.method==='POST' && action.startsWith('game-day/')) commissioner(req);
      let snapshot = await repository.getSnapshot(id);
      if(snapshot.contest.phase==='PREGAME' && now().getTime()>=Date.parse(snapshot.contest.lockAt)) {
        try { snapshot=await repository.updateDay(id,snapshot.contest.version,'lock',{}); }
        catch(e) { if(e instanceof RepositoryError && e.code==='CONTEST_VERSION_CONFLICT') snapshot=await repository.getSnapshot(id); else throw e; }
      }
      if(req.method==='GET' && action==='game-day') {
        const publicPicks=['LIVE','MAIN_EVENT','FINAL'].includes(snapshot.contest.phase);
        return {statusCode:200,body:{contest:snapshot.contest, reveal:snapshot.contest.phase==='REVEAL'?revealView(snapshot):undefined,
          ...(publicPicks?{board:boardFor(snapshot),games:snapshot.gameDay?.games??{},overrideGameIds:Object.keys(snapshot.gameDay?.overrides??snapshot.gameDay?.games??{}),providerUpdatedAt:snapshot.gameDay?.providerUpdatedAt}:{})}};
      }
      if(req.method==='POST' && action.startsWith('game-day/')) {
        commissioner(req); const body=bodyObject(req.body);
        if(!['advance','result','finalize','clear-override'].includes(action.slice('game-day/'.length))) return fail(422,'INVALID_ACTION');
        if(!Number.isSafeInteger(body.expectedVersion)) return fail(400,'INVALID_REVISION');
        try {
          const updated=await repository.updateDay(id,body.expectedVersion as number,action.slice('game-day/'.length),body);
          return {statusCode:200,body:{contest:updated.contest}};
        } catch(e) {
          if(['INVALID_RESULT','INVALID_ACTION','NOT_READY'].includes((e as Error).message)) return fail(422,(e as Error).message);
          throw e;
        }
      }
      if (req.method === 'GET' && (action === '' || action === 'pregame')) {
        const c = await repository.getSnapshot(id);
        return { statusCode: 200, body: { contest: c.contest, configuration: c.configuration, participants: Object.values(c.participants).map(p => {
          const v = validateCard(c.configuration, c.cards[p.participantId]);
          return { participantId: p.participantId, displayName: p.displayName, attendance: p.attendance, status: p.status, submissionStatus: p.submissionStatus, completedSelections: v.validSelections.length };
        }) } };
      }
      if (req.method === 'GET' && action === 'join-requests') {
        commissioner(req); const c = await repository.getSnapshot(id);
        const locked = c.contest.phase !== 'PREGAME' || !!c.contest.lockedAt || now().getTime() >= Date.parse(c.contest.lockAt);
        return { statusCode: 200, body: { requests: (await repository.listJoins(id)).filter(j => j.status === 'PENDING').map(j => ({ requestId: j.id, displayName: j.name, status: locked ? 'EXPIRED' : 'PENDING' })) } };
      }
      if (req.method === 'POST' && action === 'join-requests') {
        const body = bodyObject(req.body);
        if (typeof body.displayName !== 'string' || !body.displayName.trim() || body.displayName.length > 80) return fail(422, 'INVALID_NAME');
        const name = body.displayName.trim(); const requestId = randomUUID(); const requestSecret = randomBytes(32).toString('base64url');
        await repository.createJoin({ id: requestId, contestId: id, name, secretHash: hash(requestSecret), status: 'PENDING' });
        return { statusCode: 201, body: { requestId, requestSecret } };
      }
      const join = /^join-requests\/([a-zA-Z0-9-]+)(?:\/(approve|deny))?$/.exec(action);
      if (join && req.method === 'POST') {
        const requestId = join[1]!; const decision = join[2]; const body = bodyObject(req.body);
        if (decision) commissioner(req);
        assertOpen(await repository.getSnapshot(id), now());
        const request = await repository.getJoin(id, requestId);
        if (decision) {
          if (decision === 'deny') {
            await repository.decideJoin(id, requestId);
            return { statusCode: 200, body: { status: 'DENIED' } };
          }
          if (body.attendance !== 'ON_SITE' && body.attendance !== 'REMOTE') return fail(422, 'INVALID_ATTENDANCE');
          const participantId = randomUUID();
          await repository.decideJoin(id, requestId, { participantId, contestId: id, playerId: randomUUID(), displayName: request.name, attendance: body.attendance, status: 'ACTIVE', cardRevision: 0, submissionStatus: 'DRAFT' });
          return { statusCode: 200, body: { status: 'APPROVED', participantId } };
        }
        if (typeof body.requestSecret !== 'string') return fail(401, 'UNAUTHENTICATED');
        verifyJoinSecret(body.requestSecret, request.secretHash);
        if (request.status === 'APPROVED') {
          const token = randomBytes(32).toString('base64url');
          await repository.exchangeJoin(id, requestId, body.requestSecret, token, { contestId: id, participantId: request.participantId!, expiresAt: now().getTime() + 30 * 86400000 });
          return { statusCode: 200, body: { status: 'APPROVED' }, cookies: [setCookie('tailgate_participant', token, 30 * 86400)] };
        }
        if (request.status === 'EXCHANGED') {
          const p = await participant(req, id);
          if (p.participantId !== request.participantId) return fail(403, 'FORBIDDEN');
          return { statusCode: 200, body: { status: 'APPROVED' } };
        }
        return { statusCode: 200, body: { status: request.status } };
      }
      if (action === 'me/pick-card' && req.method === 'GET') {
        const p = await participant(req, id);
        const c = await repository.getSnapshot(id);
        if (own(c.participants, p.participantId)?.status !== 'ACTIVE') return fail(403, 'FORBIDDEN');
        return { statusCode: 200, body: cardView(c, p.participantId) };
      }
      if ((action === 'me/pick-card' && req.method === 'PUT') || (action === 'me/submit' && req.method === 'POST')) {
        const body = bodyObject(req.body);
        const p = await participant(req, id);
        if (!Number.isSafeInteger(body.expectedCardRevision) || (body.expectedCardRevision as number) < 0) return fail(400, 'INVALID_REVISION');
        try {
          const c = await repository.savePickCard({ contestId: id, participantId: p.participantId, expectedCardRevision: body.expectedCardRevision as number, card: body, submit: action === 'me/submit' });
          return { statusCode: 200, body: cardView(c, p.participantId) };
        } catch (error) {
          if ((error as Error).message === 'CARD_REVISION_CONFLICT') {
            // Build the same caller-only DTO regardless of persistence adapter.
            const c = await repository.getSnapshot(id);
            if (own(c.participants, p.participantId)?.status !== 'ACTIVE') return fail(403, 'FORBIDDEN');
            return fail(409, 'CARD_REVISION_CONFLICT', cardView(c, p.participantId));
          }
          if ((error as Error).message === 'INVALID_CARD') return fail(422, 'INVALID_CARD');
          if ((error as Error).message === 'LOCKED') return fail(409, 'LOCKED');
          throw error;
        }
      }
      return fail(404, 'NOT_FOUND');
    } catch (error) {
      if (error instanceof RepositoryError) {
        const statuses: Record<string, number> = { CONTEST_VERSION_CONFLICT: 409, NOT_FOUND: 404, UNAUTHENTICATED: 401, FORBIDDEN: 403, LOCKED: 409, CONTEST_EXISTS: 409, JOIN_ALREADY_HANDLED: 409, TOO_MANY_REQUESTS: 429, SNAPSHOT_BUSY: 503, TRANSACTION_RETRY_REQUIRED: 503 };
        const statusCode = statuses[error.code];
        if (statusCode) return { statusCode, body: { error: { code: error.code, message: error.code } } };
      }
      if (error instanceof ApiError) return { statusCode: error.status, body: { error: { code: error.code, message: error.message, ...(error.details === undefined ? {} : { details: error.details }) } } };
      return { statusCode: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Internal error' } } };
    }
  };
}
