> Historical reconstruction, superseded by the original root-level specification. Do not use as implementation authority.

# Technical architecture

Recovered decisions from “Create Pick Em Format,” through its architecture v0.2 discussion. Original embedded architecture document content was not exposed by the conversation reader; this is a reconstruction from surrounding messages. Contracts below describe intent, not completed endpoints.

## Runtime and boundaries

TypeScript modular monolith. React/Vite static frontend on private S3 behind CloudFront. CloudFront routes /api/* to API Gateway and one API Lambda. A separate polling Lambda fetches CFBD. DynamoDB uses one table with PK/SK and no initial GSIs. AppSync Events broadcasts contest_updated invalidations; clients refetch the appropriate authoritative view. EventBridge runs a fixed Saturday polling window at minute cadence, independent of presentation mode. Exact window and timezone configuration remain deployment choices.

Build local Lambda ZIPs; provision with Terraform. Keep AWS dependencies outside the domain. No VPC, NAT, containers, queue, relational database or cache in the baseline.

## State and storage

Persist source facts, selections, overrides, presentation state and audit history. Derive standings, projections, remaining points, elimination, impact scores and commentary from snapshots.

| PK | SK patterns |
| --- | --- |
| CONTEST#{contestId} | META, PARTICIPANT#{participantId}, GAME#{gameId}, PROP#{propositionId}, SLOT#{slotId}, PICK#{participantId}#{slotId}, JOIN#{requestId}, PRESENTATION |
| GAME#{gameId} | STATE, OVERRIDE |
| SESSION#{sha256(participantToken)} | META |
| PICKHISTORY#{contestId}#{participantId} | {timestamp}#{slotId}#{revisionId} |
| PLAYER#{playerId} | PROFILE, RESULT#{contestId}, STATS |

A contest partition query loads contest records; shared game states require separate reads. Handle pagination even at small scale. Keep audit history outside the main partition. Active-contest discovery without a GSI still needs a concrete design.

A proposition asks one resolvable question about one game. A PickSlot is a card position. Upset Special is one slot containing choices referencing propositions from multiple games plus NO_UPSET.

## API and concurrency

- GET /api/health
- POST /api/commissioner/login
- GET /api/contests/{id}/pregame, /reveal, /live, /main-event, /final
- PUT /api/contests/{id}/me/pick-card with expectedCardRevision and the whole card
- Explicit Submit, join request/approval/session exchange, commissioner-assisted editing, lock, override and presentation control routes to be finalized

Use per-participant cardRevision optimistic concurrency; unrelated participant edits must not conflict through the global contest version. Card mutation transactions update picks, audit revisions and contest version, checking authoritative lock state. Draft validation must accommodate incomplete cards. Every visibility-sensitive response enforces role/session, contest scope and Reveal progress on the server.

Commissioner login verifies a configured shared password and issues a signed HttpOnly cookie. Keep secrets out of source. Participant tokens are random opaque values; hash them for direct SESSION lookups. Define expiry, revocation, cookie/CSRF controls and join-exchange proof before exposing mutations.

## Polling and realtime

One provider scoreboard fetch per poll, then normalize relevant games. Compare status, period, observed clock, scores and supported possession/situation fields. Ignore changing fetch timestamps when detecting semantic differences. Persist changed state, apply overrides, recalculate and increment version once per affected contest, and publish one invalidation per contest. No CFBD call when no relevant contest needs updates. Reconnects must refetch current state; authorize subscriptions and keep picks out of event payloads.

## Deferred verification

Before cloud implementation, verify current AWS resource/provider schemas, CFBD payloads and required play data, Lambda runtime support, and packaging. No Terraform apply or cloud integration has run in this foundation.
