# DynamoDB repository milestone

The new DynamoContestRepository is an AWS SDK v3 adapter for the contest/card persistence boundary. It does not implement the local API's whole-store callback interface. The local API continues to use FileStore until its application service is refactored to explicit repository operations. No AWS resources were created or accessed during this milestone.

## Implemented

- Atomic contest creation with immutable game/proposition/slot records; duplicate creation fails rather than overwriting an open contest.
- Strongly consistent paginated contest queries, bracketed by metadata version reads. Retry up to three times if concurrent writes changed the version; then report SNAPSHOT_BUSY. Every mutation of contest records must increment contest version atomically for this protocol to hold.
- Participant creation with an existing-or-new Player profile in the same transaction as contest version increment.
- Whole-card save and explicit Submit via domain validation. The participant revision and ACTIVE status are conditions on the participant write, not conditions on the global contest version.
- Contest lock check and version increment share one Update action, avoiding DynamoDB's prohibition on multiple actions against the same item.
- Changed selections create/update/delete current PICK records and append per-slot history atomically. Tiebreak/submission changes receive a separate CARD-prefixed audit record. Unchanged or reordered selections create no per-slot history noise.
- Direct hashed session lookup, application-enforced expiry, contest scope and active-participant checks; session revocation by key. Session issuance/join approval exchange remains pending.

## Keys and payloads

| Partition | Sort key | Payload |
| --- | --- | --- |
| CONTEST#id | META | data: Contest; numeric lockAtMs; mainEventGameId |
| CONTEST#id | GAME#id / PROP#id / SLOT#id | data: immutable configuration entity |
| CONTEST#id | PARTICIPANT#id | data: participant and optional tiebreak prediction |
| CONTEST#id | PICK#participant#slot | data: selection only; no authoritative derived points |
| PICKHISTORY#contest#participant | timestamp#slot#revision | before/after selection and actor |
| PICKHISTORY#contest#participant | CARD#timestamp#revision | tiebreak/submission audit |
| PLAYER#id | PROFILE | persistent player ID/name |
| SESSION#sha256(token) | META | data: contestId, participantId, expiresAt (epoch milliseconds) |

The card-level audit and prediction placement are implementation additions. Other key patterns follow the original architecture. Keys reject embedded # delimiters. Querying a contest does not retrieve history or session secrets. Snapshot return values are internal repository data containing all picks; API presentation models must filter them before responding to any caller.

## Failure and time semantics

Card writes use at most 33 actions for the standard 15-selection card. Creation checks the 100-action ceiling and fails before sending rather than batching partial creation. DynamoDB additionally enforces 400 KiB per item and 4 MiB per transaction. No two actions may target the same item.

Participant condition failures produce CARD_REVISION_CONFLICT and the latest caller-only canonical card, or FORBIDDEN if deactivated. Metadata condition failure produces LOCKED. Other transaction cancellations produce TRANSACTION_RETRY_REQUIRED, not a misleading stale-card conflict. The service layer must implement bounded backoff and re-read/revalidate before retrying contention. AWS SDK retries within a single command reuse its ClientRequestToken. Do not blindly retry an ambiguous application-level result without refreshing the canonical card.

The time comparison uses a freshly generated application timestamp after loading the snapshot. DynamoDB has no server-time expression; it evaluates lockAtMs against that supplied timestamp. An explicit persisted lock transition must be part of deployment to close delayed/in-flight write races at the deadline. This adapter is not yet a deployed global-lock mechanism.

## Validation and remaining work

Unit/contract tests use injected SDK responses to cover key mapping, configuration reconstruction, pagination, snapshot races, transaction actions, draft deletion, Submit, expiry and failure classification. These validate generated requests and application behavior, not DynamoDB's expression engine. An actual DynamoDB Local or isolated AWS integration test remains required before deployment.

Next: explicit application-service repository interfaces, atomic JOIN approval/session exchange, game state/overrides, realtime invalidation after successful persistence, configured active-contest discovery, Terraform/IAM and Lambda wiring. Repository methods are server-internal and assume the service has authenticated the caller; do not expose them directly as HTTP authorization.

AWS references: [TransactWriteItems](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_TransactWriteItems.html), [transaction behavior](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/transaction-apis.html).
