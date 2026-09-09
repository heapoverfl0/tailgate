> Current technical architecture and implementation specification,
> converted from v0.2.

# Tailgate Pick'em

Technical Architecture & Implementation Spec Version 0.2 • 2 September
2026

Status: implementation-contract baseline; domain types, API payloads,
identity/session mechanics, and DynamoDB write semantics are now
defined.

# 1. Purpose and Scope

This document defines the technical architecture for Tailgate Pick'em: a
browser-based college-football pick'em experience with participant,
commissioner, remote-participant, and shared-display surfaces. It
complements the Product & Game Design Spec, which remains authoritative
for game rules and UX behavior. The architecture is intentionally
optimized for a small hobby application: low operating cost, minimal
operational burden, straightforward AWS deployment, reliable live
updates, and clean domain boundaries that allow the product to grow
without prematurely becoming a generalized sports platform. \# 2.
Architecture Principles - Server owns contest truth. Clients never
become authoritative for scoring, projections, proposition resolution,
standings, or elimination. - Persist facts; derive views. Store games,
propositions, picks, participants, configuration, outcomes, overrides,
and presentation decisions. Recompute standings and projections from
those facts. - Realtime is invalidation, not event sourcing. Realtime
messages say that a contest changed; clients then request the latest
authoritative presentation model. - Game data is provider-abstracted.
CollegeFootballData (CFBD) is the v1 provider, but scoring consumes
normalized internal game state. - Provider state and commissioner
overrides are separate. Effective game state is provider state with an
optional explicit override layered above it. - TV/shared-display and
phone/browser are coordinated surfaces, not responsive copies of the
same screen. - Favor managed serverless AWS services when they
materially reduce idle cost and operations. - Keep application logic a
modular monolith. Do not introduce microservices, queues, event buses,
or caches unless a demonstrated need appears. \# 3. Selected AWS
Architecture USERS phones / shared display \| +--------+---------+ \| \|
v v CloudFront AppSync Events /   realtime /   \^ v v \| S3 API Gateway
\| React/Vite \| \| v \| API Lambda ----------+ \| v DynamoDB

          EventBridge cron
                 |
                 v
           Poller Lambda
             /       \
            v         v
          CFBD     DynamoDB
                      |
                      +----> AppSync Events

# 4. Deployment Model

Production does not require containers. The frontend is compiled to
static assets; backend Lambdas are locally bundled and zipped. Terraform
provisions AWS resources and uploads the artifacts. npm run build

artifacts/ api.zip poller.zip web/ index.html assets/\*

terraform apply -\> uploads web/ to S3 -\> deploys api.zip to API Lambda
-\> deploys poller.zip to Poller Lambda CloudFront should expose the
application under one public origin where practical. Static paths
resolve to S3 and /api/\* routes resolve to API Gateway. AppSync Events
may use its AWS-managed realtime endpoint directly from the browser. \#
5. Repository and Package Structure tailgate/ apps/ web/ React + Vite
SPA api/ API Gateway Lambda entrypoint poller/ EventBridge/CFBD polling
Lambda

packages/ domain/ pure contest behavior scoring/ projections/
propositions/ outcome-engine/ reveal-director/ live-director/
commentary/

    contracts/           API DTOs and shared public types
    persistence/         repository interfaces + DynamoDB adapters
    game-data/           provider interface + CFBD adapter
    realtime/            publisher interface + AppSync adapter

infra/ terraform/

scripts/ build/deploy/dev helpers AWS SDK calls belong in adapters at
the application boundary. The domain package should be testable without
AWS, HTTP, DynamoDB, AppSync, or CFBD. \# 6. Core Domain Boundaries GAME
What happened in football? \| v PROPOSITION What question about that
game are we resolving? \| v PICK What outcome did the participant
select? \| v SCORING RULE What is that correct selection worth?

## 6.1 Effective Game State

Provider Game State + Commissioner Override (optional) \| v Effective
Game State \| v Proposition / scoring / presentation engines Provider
data remains intact even while an override is active. Removing an
override immediately returns the system to the latest provider state. \#
7. Live Game Polling Polling uses a fixed Saturday cron window rather
than dynamic schedule orchestration. The exact window is configuration,
but the intended shape is a generous late-morning-through-midnight
Central window. The poller may exit without calling CFBD when no active
contest needs live data. - EventBridge invokes the Poller Lambda every
60 seconds during the configured Saturday window. - The poller
determines whether an active contest requires live data. If not, it
exits. - The poller calls CFBD scoreboard once and normalizes only
relevant games. - Each normalized game is compared with the last
persisted provider state. - Any game-state change, including a
game-clock-only change, is persisted. - If one or more relevant games
changed, affected contests are recalculated once for that polling
cycle. - Contest version is incremented and one contest_updated realtime
invalidation is published per affected contest. \## 7.1 Latest-Observed
Game Clock The browser displays the latest clock value observed from the
provider. It must not locally count the football clock down because the
client does not know whether the official clock is running. A
provider-observed clock may remain unchanged across polls during
commercials, reviews, timeouts, incomplete passes, injuries, or other
stoppages. CFBD poll 1: Q3 12:43 -\> persist / publish CFBD poll 2: Q3
11:58 -\> persist / publish CFBD poll 3: Q3 11:58 -\> no game-state
change CFBD poll 4: Q3 10:51 -\> persist / publish \# 8. Realtime
Contract AppSync Events is transport only. Clients do not reconstruct
contest state from event history. channel: /contest/{contestId}

{ "type": "contest_updated", "contestId": "2026-week-2", "version": 184
} On receipt, a client compares the event version to its current version
and requests the latest applicable view if necessary. Duplicate events
and missed events are harmless because the synchronous API remains
authoritative. Realtime: "something changed" \| v GET
/api/contests/{id}/live \| v Authoritative latest presentation model \#
9. DynamoDB Physical Model Use one primary table with generic PK/SK
attributes. The design intentionally avoids elaborate single-table
patterns and starts with zero GSIs. Additional indexes should be
introduced only when a concrete cross-partition access pattern appears.

## 9.1 Primary Snapshot Query

The most important DynamoDB primitive is a single Query on the contest
partition: PK = CONTEST#2026-week-2 This returns current contest
metadata, participants, contest game references, propositions, current
picks, join requests, and presentation state. Because the contest is
intentionally small, loading the complete current contest is preferred
over finely fragmented reads for server-side domain calculations. \##
9.2 Reads That Stay Separate - Provider game states are read by gameId
so the same real-world football game is not duplicated into every
contest. - Pick revision history is stored under a separate partition so
normal contest reads do not retrieve audit history. - Player historical
results live under PLAYER#{playerId}, enabling straightforward
player-history queries without scanning contests. \## 9.3 Versioning and
Atomic Writes Contest META contains a monotonically increasing version.
Mutations that change authoritative contest state should increment the
version in the same DynamoDB transaction whenever practical. Example
pick edit transaction: TransactWriteItems 1. Put/Update current
PICK#participant#slot 2. Put append-only PICKHISTORY revision 3. Update
CONTEST#id / META: ADD version 1 The write path must conditionally
reject normal participant edits after global lock. Commissioner
emergency corrections use a distinct explicit override/correction
operation and audit trail. \# 10. Required DynamoDB Access Patterns

# 11. HTTP API Surface

The API is implemented by one API Lambda behind API Gateway. Internal
route organization may use a lightweight router, but routes remain one
deployable function. The endpoint list below is the implementation
baseline; exact DTO field names may evolve.

## 11.1 View Endpoints vs Raw Entities

The browser should primarily consume purpose-built presentation models
rather than stitch together many raw entity endpoints. For example,
/live may load the complete contest snapshot, effective game states, and
domain-derived values server-side and return one view optimized for the
Live UI. This keeps client logic thin and authoritative calculations
centralized. \## 11.2 Mutation Response Pattern Mutations should return
the updated relevant caller view (or at minimum the new contest version)
and publish contest_updated after persistence succeeds. This avoids
requiring the initiating browser to wait for its own realtime echo
before reflecting a successful write. \# 12. Identity and Authorization
(v1) v1 does not require full user authentication. A participant
receives a durable opaque browser token after commissioner approval. The
backend stores only a secure representation/reference and resolves the
caller to a contest participant. Commissioner access uses a separate
commissioner credential/token that is not exposed through the
participant UI. - Participant identity is scoped to server-side
authorization; display names are not credentials. - Before approval,
join requests cannot access pick cards. - Commissioner does not receive
privileged visibility into private picks before global lock. - A future
reauthorization flow may issue a new browser token without changing the
participant/player identity. \# 13. Derived State and Presentation
Models The following values are normally computed from authoritative
facts rather than stored as authoritative database fields: - Banked
contest points and rank. - Projected points/rank based on currently live
game states only; unstarted games contribute zero to PROJ. -
Maximum/potential points remaining. - Participant pick grading. -
Elimination / ability to win and paths to victory. - Live Contest Impact
Score and game ordering. - Interesting-fact candidates and most
commentary. Presentation decisions with temporal memory may be
persisted. Examples include the currently featured game, when it became
featured, reveal progress, and recently used commentary identifiers.
This provides hysteresis and avoids unstable presentation changes. \#
14. Live Poll Write Path EventBridge (60 sec) \| v Poller Lambda \|
+--\> active contest? -- no --\> done \| v CFBD scoreboard (one request)
\| v normalize relevant games \| v compare to GAME#id / STATE \| +--\>
no relevant changes --\> done \| v write all changed game states \| v
load each affected contest once \| v apply overrides -\> effective
states \| v resolve propositions / recompute views \| v update stateful
presentation decisions + contest version \| v publish one
contest_updated per affected contest Multiple football games changing in
one poll should be batched into one contest recalculation and one
invalidation event. Clock-only provider changes follow the same path
because accurate latest-observed clocks are part of Live Mode. \# 15.
Failure and Consistency Model

# 16. Terraform Resource Baseline

-   S3 bucket for private static frontend assets.
-   CloudFront distribution with Origin Access Control for S3 and
    /api/\* origin behavior to API Gateway where practical.
-   API Gateway HTTP API and API Lambda integration.
-   API Lambda and Poller Lambda IAM roles/policies with least-privilege
    access.
-   DynamoDB primary table with on-demand billing.
-   AppSync Events API / channel authorization configuration.
-   EventBridge schedule(s) for Saturday minute polling window.
-   CloudWatch log groups with explicit retention.
-   SSM Parameter Store SecureString (or equivalent) for CFBD API key
    and other secrets.
-   Optional Route 53 + ACM custom domain resources when a domain is
    selected. No VPC, NAT Gateway, ALB, ECS, RDS, Redis, SQS, or
    container registry is required in the baseline architecture. \# 17.
    Configuration and Environments Start with a deliberately small
    environment model. A local environment uses mocked/in-memory
    adapters or direct development configuration. AWS should initially
    need only one deployed environment unless a separate dev environment
    becomes useful during active implementation.

# 18. Testing Strategy

-   Domain unit tests: scoring, ATS pushes, confidence uniqueness, upset
    scoring, proposition resolution, cancellations, projections,
    elimination/path-to-win enumeration.
-   Director tests: Reveal ordering/embargo and Live Impact
    Score/hysteresis.
-   Repository contract tests: DynamoDB item mapping and transactional
    write conditions.
-   Provider adapter tests: CFBD fixture normalization, including
    scheduled/live/final/canceled states and clock updates.
-   API handler tests: authorization boundaries, lock enforcement,
    commissioner actions, and presentation DTOs.
-   End-to-end smoke test against deployed AWS: join -\> approve -\>
    picks -\> lock -\> reveal -\> simulated/provider live update -\>
    final. \# 19. Recommended Implementation Sequence
-   Create monorepo/package skeleton, TypeScript configuration, build
    scripts, lint/test baseline.
-   Implement pure domain types and scoring/proposition engine using
    fixtures before AWS adapters.
-   Implement DynamoDB repository interfaces/adapters and the physical
    key model in this spec.
-   Implement API Lambda routes for bootstrap, join/approval, identity,
    picks, and commissioner basics.
-   Implement React/Vite participant flow and shared-display shell
    against the API.
-   Implement AppSync Events publisher/subscriber using contest_updated
    invalidation.
-   Implement CFBD adapter + Poller Lambda + Saturday EventBridge cron.
-   Implement Reveal Director, then Live Director, then Main Event
    outcome UX.
-   Add finalization/history/stat projection and superlatives.
-   Harden Terraform, logging, alarms, secret handling, and deployment
    scripts. \# 20. Decisions Locked by v0.1
-   AWS serverless deployment rather than always-on ECS/RDS.
-   React + TypeScript + Vite frontend.
-   One API Lambda rather than Lambda-per-route.
-   Separate Poller Lambda triggered by fixed Saturday EventBridge cron.
-   DynamoDB rather than Postgres for v1.
-   AppSync Events rather than application-managed SSE/WebSockets;
    semantics remain invalidation + synchronous refetch.
-   CFBD live scoreboard integration is a v1 goal; \$5/month tier is
    acceptable.
-   60-second polling cadence during the configured Saturday window.
-   Any normalized game-state change, including latest-observed game
    clock, may trigger persistence and contest refresh.
-   No client-simulated football clock.
-   No provisional scoring state; provider corrections simply
    recalculate truth.
-   No GSI required initially unless a concrete new access pattern
    demands one.
-   No VPC/NAT/ALB/ECS/RDS in the baseline. \# 21. Remaining Decisions /
    Implementation Checkpoints

None of these checkpoints requires revisiting the core architecture.
They are intentionally deferred until implementation context makes the
simplest choice obvious. \# 22. Agent / Implementation Handoff An
implementation agent should be able to use this document together with
the Product & Game Design Spec as the source of truth. When ambiguity
occurs, preserve these priorities in order: correctness of contest
rules, server-authoritative state, simplicity, low operations/cost, and
clean abstraction at known expansion boundaries. The agent may create
Terraform, build Lambda ZIPs locally, run Terraform against the
designated AWS account, upload frontend assets, and execute smoke tests.
Infrastructure should remain reproducible from source; manual console
configuration should be avoided except for unavoidable account/bootstrap
steps. \# 23. Implementation Contracts: IDs, Time, and Versioning The
following conventions are implementation contracts rather than product
behavior. Their purpose is to make logs, DynamoDB items, API payloads,
tests, and agent-generated code predictable. \# 24. Core TypeScript
Domain Contracts Domain packages use discriminated unions and plain data
structures. AWS SDK types, HTTP request objects, CFBD response types,
and DynamoDB AttributeValue objects must not cross into the domain
package. type Id = string; type IsoDateTime = string;

type Attendance = "ON_SITE" \| "REMOTE"; type ParticipantStatus =
"ACTIVE" \| "NOT_PLAYING"; type GameStatus = "SCHEDULED" \|
"IN_PROGRESS" \| "FINAL" \| "CANCELED" \| "POSTPONED"; type
PropositionStatus = "UNRESOLVED" \| "RESOLVED" \| "VOID"; type
PickResult = "PENDING" \| "WIN" \| "LOSS" \| "PUSH" \| "VOID"; \## 24.1
Contest and Participant interface Contest { id: Id; name: string;
timezone: string; lockAt: IsoDateTime; phase: "PREGAME" \| "REVEAL" \|
"LIVE" \| "MAIN_EVENT" \| "FINAL"; lockedAt?: IsoDateTime; finalizedAt?:
IsoDateTime; version: number; }

interface ContestParticipant { contestId: Id; participantId: Id;
playerId: Id; displayName: string; attendance: Attendance; status:
ParticipantStatus; cardRevision: number; submissionStatus: "DRAFT" \|
"SUBMITTED"; submittedAt?: IsoDateTime; lastEditedBy?: "PARTICIPANT" \|
"COMMISSIONER"; lastEditedAt?: IsoDateTime; } SUBMITTED means the
participant has explicitly declared the card complete. It does not lock
the card. Valid edits remain allowed until the global lock. The UI must
not imply that submission prevents later edits. \## 24.2 Normalized Game
State interface GameRef { gameId: Id; provider: "CFBD"; externalGameId:
string; }

interface GameState { gameId: Id; status: GameStatus; homeTeamId: Id;
awayTeamId: Id; homeScore?: number; awayScore?: number; period?: number;
clock?: string; // latest provider-observed clock, e.g. "06:42"
possessionTeamId?: Id; situation?: string; // normalized/display-safe if
supported observedAt: IsoDateTime; // when our poll observed this
provider state providerUpdatedAt?: IsoDateTime; }

interface EffectiveGameState extends GameState { overrideActive:
boolean; overrideFields?: string\[\]; } The browser never decrements
clock locally. Clock changes are meaningful normalized state changes and
may cause persistence, recalculation, and realtime invalidation even
when score and period are unchanged. \## 24.3 Outcomes and Propositions
type Outcome = \| { kind: "TEAM"; teamId: Id } \| { kind: "TOTAL_SIDE";
side: "OVER" \| "UNDER" } \| { kind: "SCORE_TYPE"; scoreType:
"TOUCHDOWN" \| "FIELD_GOAL" \| "OTHER" } \| { kind: "TIE" };

type PropositionType = \| "STRAIGHT_UP_WINNER" \| "AGAINST_SPREAD" \|
"FIRST_TEAM_TO_SCORE" \| "FIRST_SCORE_TYPE" \| "HALFTIME_LEADER" \|
"GAME_TOTAL";

interface Proposition { id: Id; contestId: Id; gameId: Id; type:
PropositionType; label: string; parameters: PropositionParameters;
status: PropositionStatus; resolvedOutcome?: Outcome; resolvedAt?:
IsoDateTime; }

type PropositionParameters = \| { kind: "STRAIGHT_UP_WINNER" } \| {
kind: "AGAINST_SPREAD"; favoredTeamId: Id; spread: number; source:
string; capturedAt: IsoDateTime } \| { kind: "FIRST_TEAM_TO_SCORE" } \|
{ kind: "FIRST_SCORE_TYPE" } \| { kind: "HALFTIME_LEADER"; allowTie:
true } \| { kind: "GAME_TOTAL"; total: number; source?: string;
capturedAt?: IsoDateTime }; \## 24.4 Pick Slots: User-Facing Selection
Constraints A proposition is an adjudicable question about one football
game. A pick slot is a required/optional place on a participant card.
This distinction is necessary because the Upset Special is one user
selection across several different game propositions, while most other
slots map one-to-one to a proposition. type PickCategory = "CONFIDENCE"
\| "ATS" \| "UPSET_SPECIAL" \| "MAIN_EVENT";

interface PickSlot { id: Id; contestId: Id; category: PickCategory;
order: number; label: string; required: boolean; choices:
PickChoice\[\]; }

type PickChoice = \| { id: Id; kind: "PROPOSITION_OUTCOME";
propositionId: Id; outcome: Outcome; points?: number } \| { id: Id;
kind: "NO_UPSET"; points: 1 };

interface Pick { contestId: Id; participantId: Id; slotId: Id; choiceId:
Id; confidence?: 1 \| 2 \| 3 \| 4 \| 5 \| 6; result: PickResult;
pointsAwarded?: number; editedBy: "PARTICIPANT" \| "COMMISSIONER";
editedAt: IsoDateTime; } - Confidence: six slots, each tied to one
straight-up proposition; confidence values 1-6 must each be used exactly
once for a submitted card. - ATS: three slots, each tied to one ATS
proposition; normal win=2, push=1, loss=0. - Upset Special: one slot
whose choices point at curated straight-up propositions for underdogs,
each with its frozen point value, plus NO_UPSET worth 1. - Main Event:
five slots, each tied to one GT/Tennessee proposition and worth 1 point.
Pick result and pointsAwarded are derived from proposition/game facts
and may be included in read models. They need not be persisted on the
current PICK item as authoritative facts; if cached later, they must be
treated as disposable projections. \# 25. DynamoDB Physical Model v0.2
The original one-table design remains valid. v0.2 adds SLOT items and
direct-key session items, and changes current pick keys to be
slot-based. This better reflects the user-facing card and preserves
zero-GSI authorization. \## 25.1 Why Sessions Get Their Own Key
Participant session tokens are random bearer secrets and remain opaque
to the browser. The server hashes the presented token and performs
GetItem on SESSION#{hash} / META. This gives O(1) authorization,
supports revocation/re-authorization, and avoids a token GSI. Only the
hash is stored. Commissioner sessions are signed cookies and do not
require DynamoDB session items in v1. \## 25.2 Whole-Card Autosave
Transaction The participant autosave API writes the complete current
pick card rather than a single proposition. At 15 selections the
transaction is small, and whole-card validation makes confidence
uniqueness and cross-slot constraints deterministic. PUT
/api/contests/{contestId}/me/pick-card If-Match-Card-Revision: 12

server: 1. authorize participant 2. load contest snapshot / relevant
card configuration 3. reject if now \>= lockAt or contest locked 4.
validate every supplied slot/choice and confidence constraints 5. diff
against persisted current card 6. TransactWriteItems: - condition
PARTICIPANT.cardRevision == 12 - put/update changed PICK items - append
revision item for each changed slot - update PARTICIPANT cardRevision =
13 + edit metadata - increment CONTEST META version 7. publish
contest_updated(version) 8. return canonical card + cardRevision 13 A
stale cardRevision returns HTTP 409 with the latest canonical card. This
avoids using global contest version as an edit ETag; another participant
saving picks should never cause this participant to receive an
optimistic-concurrency conflict. \## 25.3 Submission Transaction
Submitting is a distinct operation because it affects Pregame completion
status and commentary but does not freeze picks. POST
/api/contests/{contestId}/me/submit

validate complete card TransactWriteItems: - condition participant
cardRevision still current - set submissionStatus=SUBMITTED,
submittedAt=now - increment contest version publish contest_updated
Subsequent valid edits keep submissionStatus=SUBMITTED. If future UI
permits clearing a required answer, the server must automatically return
the card to DRAFT; v1 can simply prohibit an invalid/incomplete autosave
state once submitted. \# 26. Participant and Commissioner Identity
Contracts \## 26.1 Join / Approval / Participant Session - Browser POSTs
a display name to /join-requests. Server creates JOIN item and returns
requestId plus a random request secret. The raw secret is kept only by
the browser; a hash is stored with the request. - Browser polls its join
status using requestId + request secret. This reveals only that request
status, not contest picks. - Commissioner approves the request and
selects ON_SITE or REMOTE. Approval creates PLAYER/participant data as
needed but does not expose a participant bearer token to the
commissioner. - On the next approved-status request, the server creates
a random participant session token, stores SESSION#{sha256(token)}, and
sets it as an HttpOnly Secure SameSite=Lax cookie. The join request is
marked exchanged so the raw session is not issued repeatedly. - Normal
participant endpoints authorize from the session cookie and verify
contestId/participantId/status. - Commissioner reauthorization revokes
existing session item(s) or issues a new session through an explicit
recovery flow. v1 may keep this manual. \## 26.2 Commissioner Login The
commissioner experience intentionally uses a shared configured password.
It is not a user-account system. POST /api/commissioner/login {
"password": "..." }

200 -\> Set-Cookie: tailgate_commissioner=`<signed-token>`{=html};
HttpOnly; Secure; SameSite=Lax 401 -\> generic invalid-credential
response - Password is supplied as deployment secret/configuration and
is never committed to the repository or shipped to the frontend. -
Signed commissioner session contains role=COMMISSIONER, issued-at,
expiry, and optional credentialVersion. Suggested expiry: 30 days. - A
server-side HMAC signing secret is separately configured. Changing
password/session secret can invalidate old commissioner sessions. - No
Cognito, OAuth, password reset, email verification, or per-commissioner
account model in v1. \# 27. HTTP API v0.2: Concrete Contract All JSON
responses use camelCase. Error bodies share one envelope: { error: {
code, message, details? } }. Expected domain conflicts use 409;
unauthenticated uses 401; authenticated-but-forbidden uses 403; invalid
request uses 400 or 422. \## 27.1 Pick-Card Request interface
SavePickCardRequest { expectedCardRevision: number; picks: Array\<{
slotId: string; choiceId: string; confidence?: 1 \| 2 \| 3 \| 4 \| 5 \|
6; }\>; }

interface SavePickCardResponse { contestVersion: number; cardRevision:
number; submissionStatus: "DRAFT" \| "SUBMITTED"; picks:
PickCardSelectionView\[\]; validation: { complete: boolean;
missingSlotIds: string\[\] }; } \## 27.2 Live Read Model interface
LiveContestView { contestId: string; version: number; generatedAt:
IsoDateTime; phase: "LIVE" \| "MAIN_EVENT" \| "FINAL"; standings:
LiveStandingView\[\]; games: LiveGameView\[\]; featuredGameId?: string;
commentary?: CommentaryView; upcoming: UpcomingGameView\[\]; }

interface LiveStandingView { participantId: string; displayName: string;
attendance: Attendance; actualPoints: number; projectedPoints: number;
potentialPoints: number; rank: number; projectedRank: number; rankDelta:
number; }

interface LiveGameView { gameId: string; teams: { home: TeamView; away:
TeamView }; status: GameStatus; score?: { home: number; away: number };
period?: number; clock?: string; // latest observed; never
client-simulated observedAt: IsoDateTime; impact: { score: number; tier:
"FEATURED" \| "SECONDARY" \| "MINIMUM" }; exposures:
ContestExposureView\[\]; }

interface ContestExposureView { category: PickCategory; propositionId:
string; label: string; picks: Array\<{ participantId: string;
displayName: string; selectionLabel: string; pointsAtStake: number }\>;
} The live payload intentionally duplicates some labels/display data so
the frontend can render one coherent screen without reconstructing
domain state. DTO duplication is preferable to leaking
persistence/domain entities into the browser. \## 27.3 Pregame Privacy
Contract Before global lock, public/shared Pregame responses may expose
participant names, attendance, submission/completion state, slate,
frozen lines, countdown, and commentary that does not reveal selections.
A participant-authenticated response may additionally include only that
participant's own selections. Commissioner responses do not gain
pre-lock visibility into other participants' picks. \## 27.4 Reveal
Embargo Contract Reveal is enforced server-side, not by hiding
already-downloaded data in JavaScript. /reveal includes only
selections/facts permitted by the current persisted reveal step. Full
pick data becomes public only after the reveal director reaches the
public-unlock step. \# 28. Repository Interfaces and Endpoint Access
Validation interface ContestRepository { getContest(contestId: Id):
Promise`<Contest>`{=html}; getSnapshot(contestId: Id):
Promise`<ContestSnapshot>`{=html}; savePickCard(input:
SavePickCardCommand): Promise`<SavePickCardResult>`{=html};
submitCard(input: SubmitCardCommand):
Promise`<SubmitCardResult>`{=html}; updateParticipant(...):
Promise`<void>`{=html}; updatePresentation(...): Promise`<void>`{=html};
}

interface GameRepository { getProviderState(gameId: Id):
Promise\<GameState \| undefined\>; getOverride(gameId: Id):
Promise\<GameOverride \| undefined\>; putProviderStates(states:
GameState\[\]): Promise`<void>`{=html}; putOverride(...):
Promise`<void>`{=html}; deleteOverride(...): Promise`<void>`{=html}; }

interface SessionRepository { createParticipantSession(...):
Promise`<string>`{=html}; // returns raw token once
resolveParticipantSession(rawToken: string): Promise\<ParticipantSession
\| undefined\>; revokeParticipantSession(rawToken: string):
Promise`<void>`{=html}; }

interface RealtimePublisher { contestUpdated(contestId: Id, version:
number): Promise`<void>`{=html}; }

interface GameDataProvider { getScoreboard():
Promise\<ProviderGameState\[\]\>; } Conclusion: the v0.2 endpoint and
authorization surface still requires zero GSIs. The first likely future
GSI remains "find all active contests using external/internal game X" if
multiple simultaneous contests are introduced. \# 29. Poller and
Realtime Detailed Contract The poller is scheduled every minute in the
configured Saturday window. It may invoke frequently, but it only calls
CFBD while an active contest requires live data. A single scoreboard
call covers all relevant games for that cycle. poll(): active =
loadActiveContestConfiguration() if !active.requiresLiveData(now):
return

providerGames = cfbd.getScoreboard() normalized =
normalizeRelevant(providerGames, active.gameRefs) changed =
compareWithPersistedProviderState(normalized) if changed.empty: return

persist changed GAME#id / STATE items

snapshot = load contest once effectiveGames = provider state + optional
overrides derive resolutions / standings / PROJ / potential / impact /
commentary update any newly authoritative proposition outcomes +
presentation memory increment contest version once publish { type:
"contest_updated", contestId, version } once - A change in score,
status, period, latest-observed clock, or other normalized field used by
presentation/domain logic counts as changed state. - Provider observedAt
may change every poll; observedAt alone must not cause a "meaningful
state changed" comparison, otherwise every successful poll would write
even when the football state is identical. - If only clock changes, the
same simple recalculation path is used. At this scale, avoiding a
separate clock-only processing path is preferable to optimizing tiny
compute cost. - AppSync event payload remains tiny and
non-authoritative. Clients refetch the view appropriate to their current
phase/surface. \# 30. Implementation Decisions Locked by v0.2 -
Participant sessions use random opaque bearer tokens stored only as
SHA-256 hashes under direct SESSION keys; no session GSI. - Commissioner
auth is a configured shared password exchanged for a signed HttpOnly
session cookie; no Cognito/OAuth in v1. - Pick slots are explicit
domain/configuration entities; propositions remain single-game
adjudicable questions. - Current picks are keyed by participant + slot,
not participant + proposition. - Participant autosave sends the whole
15-selection card and uses participant cardRevision for optimistic
concurrency. - Global contest version is for client freshness/realtime
invalidation, not pick-edit concurrency. - Submission is explicit, does
not lock picks, and remains editable until global lock. - Reveal embargo
is enforced in server read models; clients never receive future reveal
data early. - Internal game IDs are provider-independent; CFBD external
IDs live in contest game references/provider mapping. - Zero GSIs remain
sufficient for the v1 API and authorization access patterns. \# 31. Next
Implementation Checkpoint The architecture is now detailed enough to
create the repository skeleton and Terraform baseline without inventing
major semantics. The next checkpoint should produce compiling TypeScript
packages with these domain/contracts, tests for scoring/card validation,
and Terraform that provisions the static frontend, API Lambda, poller
Lambda, DynamoDB table, AppSync Events, EventBridge schedule, and
secret/configuration inputs. UI design can proceed in parallel against
the purpose-built read-model interfaces.
