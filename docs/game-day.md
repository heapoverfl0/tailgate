# Manual game-day flow — September 11, 2026

The deployed app now supports deadline lock, a commissioner-controlled Reveal, manual game facts, server-calculated standings and final result persistence. Automatic provider ingestion and the full presentation directors remain later work.

## Running the day

At noon Eastern the API rejects card saves and joins. The first contest request at/after the deadline persists REVEAL and lockedAt; active browsers poll game-day data every three seconds. No scheduler or exact-second background invocation is implied. A persisted lock blocks even stale writes prepared before the transition. DynamoDB still cannot compare its own clock in a condition: an in-flight request prepared just before the deadline can commit before the first persisted lock. This known network-boundary limitation remains; lock ordering is atomic once the transition commits.

Sign into Commissioner on the participant page. Use Next Reveal step to present lock, consensus, lone wolves, Upset Special, confidence stakes and Main Event. The final button publishes all picks. Shared and participant browsers observe the same persisted step. This first director is manually paced (aim for roughly 2–4 minutes); it does not yet use edit-history/cold-feet commentary, automatic timing, personalized remote/on-site presentation or sophisticated ranking.

Only the current step's selected facts are returned by `/game-day`; complete cards, predictions and grades are withheld until LIVE. The initial lock step contains no picks. Pregame endpoints continue returning only public configuration and completion, including for commissioners. No commissioner endpoint exposes private cards during the embargo.

After Reveal, open Commissioner results entry. Select a game, enter observed scores and status, and provide a source/reason. Final scores resolve straight-up winners, frozen ATS spreads and totals together. Main Event first team/scoring play and halftime are separate facts; they are never guessed from final scores. Enter first team and first scoring play together; use VOID when a proposition cannot be resolved that day. Whole-game VOID covers cancellation/postponement. User decision: an exact Main Event total tie is VOID, zero points for everyone. ATS pushes remain one point. No Upset retains its guaranteed point.

Corrections replace the prior manual game fact and recalculate standings; every transition/entry has an append-only audit record. Manual facts live separately from frozen contest configuration. There is no provider state yet; future provider integration must preserve a distinct override layer. Correct results before finalizing. Finalize is enabled only after every game is FINAL/VOID and every proposition resolves. Finalization persists the scored entries, category/slot results, predictions and champion IDs with finalizedAt. Finalized contests reject further result entry; a reopen/correction workflow after finalization is not implemented. Persistent records support later historical statistics; no career-statistics UI exists yet.

Standings show banked points, with equal-point ranks shared. The champion calculation applies the Main Event score-error tiebreak, with co-champions if still tied. Missing/unanswered selections score zero; incomplete drafts retain their valid selections. Projections, potential/elimination calculations, live provider clocks and automatic game updates are not displayed.

## Persistence and concurrency

`Repository.updateDay` compares expected contest version, updates META and creates an AUDIT item in one DynamoDB transaction. Card writes update that same META item and retain participant cardRevision checks. Conflicting commissioner updates return 409 and refresh; invalid or premature actions return 422. No changes to real contest configuration, enrollment or picks are required by deployment. No new dependencies or AWS permissions were added.

## Verification

- 59 unit/API/repository tests pass, including simultaneous same-card writes, inclusive lock, initial and staged embargo, authorization, stale transitions, correlated scoring, corrections and persistent final history.
- DynamoDB Local rehearsal passes lock → Reveal → results → finalization using the existing reviewed network-isolated container, then removes it.
- Browser rehearsal verifies commissioner login, stepping Reveal, full-pick unlock, manual final-score submission and the resulting nine-point Confidence/ATS/Upset award in a synthetic fixture.
- `scripts/smoke-api.py` now rehearses the deployed game-day path in a unique synthetic contest. It moves only that contest's deadline forward, verifies privacy and finalization, then deletes that contest, synthetic players, sessions and histories. Never use synthetic deadline manipulation on real contests.

The API and frontend builds pass. API packaging still excludes web dependencies. The deployment plan only updates API code and frontend assets.

The deployed HTTPS rehearsal passed all steps and removed 93 synthetic records. Published HTML, CSS and JS match the build; the real revised contest remains PREGAME and its game-day response contains no board/cards.

The subsequent [CFBD integration](cfbd-integration.md) adds automated scoreboard/play polling and a separate override layer for the revised contest. It supersedes the earlier manual-only/provider-pending status; advanced projections and directors remain pending.
