# DynamoDB repository milestone

DynamoContestRepository implements the explicit Repository interface used by createService. StoreRepository provides the same operations over the single-process local FileStore. Lambda uses DynamoDB and the local server uses FileStore. No AWS resources were created or accessed during this milestone.

## Implemented

- Atomic contest creation with immutable game/proposition/slot records; duplicate creation fails rather than overwriting an open contest.
- Strongly consistent paginated contest queries, bracketed by metadata version reads. Retry up to three times if concurrent writes changed the version; then report SNAPSHOT_BUSY. Every mutation of contest records must increment contest version atomically for this protocol to hold.
- Participant creation with an existing-or-new Player profile in the same transaction as contest version increment.
- Whole-card save and explicit Submit via domain validation. The participant revision and ACTIVE status are conditions on the participant write, not conditions on the global contest version.
- Contest lock check and version increment share one Update action, avoiding DynamoDB's prohibition on multiple actions against the same item.
- Changed selections create/update/delete current PICK records and append per-slot history atomically. Tiebreak/submission changes receive a separate CARD-prefixed audit record. Unchanged or reordered selections create no per-slot history noise.
- Direct hashed session lookup, application-enforced expiry, contest scope and active-participant checks; session revocation by key. Atomic join creation, approval/denial and session issuance are implemented.

## Keys and payloads

| Partition | Sort key | Payload |
| --- | --- | --- |
| CONTEST#id | META | data: Contest; numeric lockAtMs; mainEventGameId; pendingJoins counter |
| CONTEST#id | GAME#id / PROP#id / SLOT#id | data: immutable configuration entity |
| CONTEST#id | JOIN#requestId | request name, secret hash, status and approved participant ID |
| CONTEST#id | PARTICIPANT#id | data: participant and optional tiebreak prediction |
| CONTEST#id | PICK#participant#slot | data: selection only; no authoritative derived points |
| PICKHISTORY#contest#participant | timestamp#slot#revision | before/after selection and actor |
| PICKHISTORY#contest#participant | CARD#timestamp#revision | tiebreak/submission audit |
| PLAYER#id | PROFILE | persistent player ID/name |
| SESSION#sha256(token) | META | data: contestId, participantId, expiresAt (epoch milliseconds); top-level expiresAt (TTL epoch seconds) |

The card-level audit and prediction placement are implementation additions. Other key patterns follow the original architecture. Keys reject embedded # delimiters. Querying a contest does not retrieve history or session secrets. Snapshot return values are internal repository data containing all picks; API presentation models must filter them before responding to any caller.

## Failure and time semantics

Card writes use at most 33 actions for the standard 15-selection card. Creation checks the 100-action ceiling and fails before sending rather than batching partial creation. DynamoDB additionally enforces 400 KiB per item and 4 MiB per transaction. No two actions may target the same item.

Participant condition failures produce CARD_REVISION_CONFLICT and the latest caller-only canonical card, or FORBIDDEN if deactivated. Metadata condition failure produces LOCKED. Other transaction cancellations produce TRANSACTION_RETRY_REQUIRED, not a misleading stale-card conflict. The service returns 503 for storage contention or a busy snapshot. Clients must back off and refresh state before an application-level retry; automatic application retries are deliberately not enabled for ambiguous writes. AWS SDK retries within a single command reuse its ClientRequestToken. Do not blindly retry an ambiguous application-level result without refreshing the canonical card.

The time comparison uses a freshly generated application timestamp after loading the snapshot. DynamoDB has no server-time expression; it evaluates lockAtMs against that supplied timestamp. An explicit persisted lock transition must be part of deployment to close delayed/in-flight write races at the deadline. This adapter is not yet a deployed global-lock mechanism.

## Validation and remaining work

Unit/contract tests use injected SDK responses to cover key mapping, configuration reconstruction, pagination, snapshot races, transaction actions, draft deletion, Submit, expiry and failure classification. These validate generated requests and application behavior, not DynamoDB's expression engine. An actual DynamoDB Local or isolated AWS integration test remains required before deployment.

Next: run database integration validation, add game state/overrides, realtime invalidation after successful persistence, configured active-contest discovery, Terraform/IAM and Lambda packaging. Repository methods are server-internal and assume the service has authenticated the caller; do not expose them directly as HTTP authorization.

AWS references: [TransactWriteItems](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_TransactWriteItems.html), [transaction behavior](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/transaction-apis.html).

## API integration checkpoint — September 10, 2026

Join creation increments a pending counter on contest META, capped at 100 in the same transaction as the new JOIN. Approval or denial requires PENDING status, decrements that counter and increments contest version. Approval also creates the participant and Player profile atomically. New tables initialize pendingJoins to zero; any older externally created table with pending JOIN records would require a counter backfill before these operations.

Session exchange verifies the request secret and requires APPROVED status and matching participant ID/hash in the transaction, plus ACTIVE participant status. It changes the request to EXCHANGED and writes only the random session token's hash. Two competing exchanges cannot both issue sessions. The API sets a cookie only after successful persistence. TTL uses seconds at the item root, while authorization checks the session's millisecond expiry itself. Terraform must enable TTL on expiresAt; correctness does not rely on timely deletion.

An already exchanged request requires the existing participant cookie and does not issue another token. Lost exchange responses still require manual recovery; automatic token recovery/reissue is deferred. All join mutations share the same contest lock/version guard used by card writes. Public and commissioner DTOs never expose JOIN secrets, session records or private cards.

The API Gateway HTTP API v2 handler supports cookies, base64 bodies, normalized header names, JSON errors and the local server's 128 KiB body limit. Lambda requires TAILGATE_TABLE, HTTPS APP_ORIGIN, COMMISSIONER_PASSWORD and SESSION_SIGNING_SECRET. It no longer silently uses the demo repository. Packaging, deployment, distributed login throttling and the explicit persisted lock transition remain required before production.

### Database integration test

With an already running, reviewed DynamoDB Local instance:

```sh
TAILGATE_DYNAMO_TEST_ENDPOINT=http://127.0.0.1:8000 npm run test:integration
```

The test accepts only a loopback HTTP endpoint, supplies dummy credentials, creates a uniquely named test table and deletes only that table in cleanup. It exercises the full API through the SDK, including duplicate creation, approval, competing exchanges, hashed sessions, save/Submit, canonical conflicts, denial, privacy, lock and revocation. Without the endpoint it explicitly skips.

Validation on this machine: 56 unit/API/SDK-contract tests passed and TypeScript built successfully. The integration suite compiled but was skipped: no local endpoint was configured and Docker's daemon was unavailable. No database runtime or dependency was downloaded, no AWS credentials were used, and actual DynamoDB expression validation remains outstanding.
