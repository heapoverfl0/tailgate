# Durable local API milestone

The local server uses createService with StoreRepository wrapping FileStore. Lambda uses the same service with DynamoContestRepository. No external dependencies were added for this integration. See the DynamoDB milestone for cloud configuration and validation limits; file storage remains development-only.

## Start

Copy .env.example to .env. Choose a commissioner password and a separate random signing secret of at least 32 characters. Set APP_ORIGIN to the exact browser origin (default http://127.0.0.1:3001). Run npm run dev:api. The server binds only to loopback. A future Vite frontend should proxy /api and set APP_ORIGIN to its browser origin.

.env and .local are ignored by Git. Local cookies omit Secure for loopback HTTP, but remain HttpOnly/SameSite=Lax. HTTPS deployments must enable Secure. Node's --env-file loads local configuration; secrets never need to appear in command arguments.

## Workflow

All mutation requests require Origin matching APP_ORIGIN, Content-Type application/json, and the relevant cookies. No CORS headers are emitted. An API client needs a cookie jar.

| Method | Route | Body / authorization |
| --- | --- | --- |
| GET | /api/health | public |
| POST | /api/commissioner/login | password; sets signed commissioner cookie |
| POST | /api/contests | commissioner; contest {id,name,timezone,lockAt} and configuration matching domain model |
| GET | /api/contests/{id} or /pregame | public contest/configuration/completion; never picks |
| POST | /api/contests/{id}/join-requests | displayName; returns requestId and one-time requestSecret |
| GET | /api/contests/{id}/join-requests | commissioner pending list; never request secrets |
| POST | /api/contests/{id}/join-requests/{requestId}/approve | commissioner; attendance ON_SITE or REMOTE |
| POST | /api/contests/{id}/join-requests/{requestId}/deny | commissioner; empty object |
| POST | /api/contests/{id}/join-requests/{requestId} | requestSecret; poll/exchange for participant cookie |
| GET | /api/contests/{id}/me/pick-card | participant; own card only, also after lock |
| PUT | /api/contests/{id}/me/pick-card | participant; expectedCardRevision, picks, optional prediction |
| POST | /api/contests/{id}/me/submit | participant; expectedCardRevision; validates persisted card |

The synthetic configuration and complete card in packages/domain/src/fixture.ts demonstrate a valid request. No real teams, odds or users are seeded automatically. Initial cardRevision is zero. Save and Submit each increment it. Stale revisions return 409 plus the caller's canonical card; incomplete Submit returns 422; lock rejects normal mutations at or after lockAt. Configuration is fixed at create/open; no configuration-update route exists.

## Persistence and privacy

Transactions serialize inside one server, clone state, validate/mutate, write a private temporary file, rename it, then publish the in-memory state. Failed persistence leaves memory unchanged. This provides a useful single-process local adapter, not multi-process locking, distributed transactions or power-loss fsync guarantees. Run one API process per data file.

Session/request tokens are random; only their hashes persist. Commissioner cookies use HMAC, expiry and a secret-keyed credential version so password rotation invalidates them without exposing a password hash. Sessions last 30 days. Approval never reveals a participant token to the commissioner. Replaying an exchanged request only succeeds with that participant's existing cookie and never issues another token. If the original exchange response is lost before the cookie arrives, recovery remains manual; automated reauthorization is deferred.

The file includes private cards and audit snapshots; keep it local and backed up appropriately. Audit records are whole-card before/after snapshots at each accepted mutation. DynamoDB maps changes into separate per-slot history partitions and atomic card/version/lock operations. DynamoDB approval creates persistent Player profiles; the local file adapter carries player IDs in participant entries only.

## Limits and next work

The server limits request bodies to 128 KiB, pending join requests to 100 per contest, and commissioner login attempts to 10 per minute per process. Distributed rate limiting, session revocation/recovery, commissioner-assisted edits, explicit lock/Reveal state transitions and AppSync invalidations are not implemented. Pending joins become unavailable at lock. This slice validates pregame privacy; it does not implement public Reveal/live views.

Automated tests exercise login/join/approve/exchange/save/Submit, stale and concurrent writes, foreign sessions, privacy, lock-time rejection, failed persistence and restart recovery. The service tests run directly against the request router and file adapter; full browser flows and AWS deployment tests remain later work. A real HTTP smoke test also passed: health 200, malformed JSON 400, and login 200 with an HttpOnly cookie. The current build and all 56 automated tests pass. Lambda request parsing/cookies and concurrent approval/session exchange are also covered. Actual DynamoDB expression-engine validation remains pending.
