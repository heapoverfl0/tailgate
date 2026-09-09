# Pick-card domain milestone

Pure TypeScript in packages/domain. No new third-party dependencies. Original product and architecture specs remain unchanged.

## Implemented

- Contest, Player, ContestParticipant, Game, Proposition, Outcome, PickSlot, Pick and card contracts.
- Config validation for 6 Confidence, 3 ATS, 1 Upset and 5 Main Event slots; all allowed choices; ownership/reference integrity; unique games within Confidence/ATS; Main Event exclusion; frozen line/odds metadata and scoring limits.
- Detached recursively frozen configuration snapshot at open. Persist this snapshot; repository writes must enforce that opened configuration cannot be replaced. Object.freeze alone is not a database invariant.
- Unknown-input card validation with partial drafts, missing-selection reporting, confidence uniqueness, score prediction and duplicate/foreign selection checks.
- Pure save/Submit guard for participant scope/status, inclusive global lock, per-card revision and submission transitions. The later repository must repeat lock/revision conditions atomically; this function does not authorize HTTP callers or persist anything.
- Grading from supplied proposition resolutions: confidence, ATS win/push, Upset, guaranteed NO_UPSET, Main Event, voids, missing/invalid selections and recomputation after corrected results.
- Working moneyline tiers and champion selection by points, then final-score error, retaining co-champions.

## Explicit implementation choices

- A winner-only confidence draft is allowed and incomplete; it scores zero until paired with valid confidence. Missing picks are omitted from the whole-card request.
- Reject duplicate confidence or duplicate slots on save. If invalid historical/imported data reaches lock-time scoring, every involved pairing earns zero while unrelated selections remain eligible.
- A complete submitted card includes the final-score prediction in addition to 15 selections. The prediction is a home/away object separate from scoring picks, an addition to the v0.2 save payload.
- Complete edits keep SUBMITTED. Clearing a required answer after Submit is rejected, following architecture 25.3's allowed simple v1 behavior.
- A missing tiebreak prediction cannot beat a valid prediction when the actual final score is available. If all tied leaders lack predictions, they remain co-champions. If the actual score is unavailable, skip the tiebreak entirely.
- Proposition configuration and resolution are separate. The internal resolution input represents ATS PUSH explicitly; it is not a new selectable outcome. Non-ATS pushes throw until their rule is decided.
- NO_UPSET scores a guaranteed one when grading a locked card, independent of football cancellations. Callers must keep draft/private scoring out of public pre-lock views.
- Require upset source, captured time, odds and frozen points. The supplied 2–6 value controls scoring; working moneyline tiers are a curation helper, not a live recalculation.

## Boundaries

Game-data-to-proposition resolution, projections, potential points, correlated outcome analysis, persistence, authentication, HTTP save/Submit routes and browser UI remain next-stage work. scoreCard expects authoritative compatible resolutions; it does not derive or prove cross-proposition game consistency. Provider cancellations must be normalized to VOID before grading. Typed configuration input is trusted domain data; future HTTP configuration endpoints must parse untrusted payloads before calling the validator.

The demo API continues using its development summary fixture. The new functions are not yet exposed through HTTP.
