# CFBD automation — September 11, 2026

The revised September 12 contest uses the personal Tier 2 CFBD key. `/info` confirmed Tier 2, live scoreboard and live play-by-play access with a 30,000-call monthly allowance. No dependencies were installed or added. HTTP uses Node's built-in fetch with timeouts and redirects disabled.

## Scope and schedule

Only `sept12-2026-revised` is configured. Seven game, home-team and away-team IDs were matched against CFBD's 2026 Week 2 schedule and recorded in `infra/terraform/cfbd-mappings.json`; ECU maps to CFBD's East Carolina name. Frozen contest choices/lines were not changed.

EventBridge invokes `tailgate-poller` once per minute during Saturday 16:00–23:59 UTC and Sunday 00:00–07:59 UTC. The handler additionally limits fetching to September 12, 2026 16:00 UTC through September 13 08:00 UTC (noon Eastern Saturday through 4 a.m. Sunday). It stops fetching when the contest is FINAL. Later weekends may invoke the function, but the date guard returns without CFBD calls or database writes. Future contests require explicit mapping/window/IAM updates; the superseded original contest is not polled.

A cycle reads the scoreboard once for all seven games. It calls live plays only for the Main Event while in progress/final. Scheduled scores stay absent, not invented 0–0. Unknown statuses, missing games and malformed scores preserve earlier observations and report warnings. Games never become canceled merely because a response omitted them.

The current provider state, explicit commissioner overrides and effective games are separate. Updates are atomic and guarded by contest version. A concurrent commissioner action causes a failed poll rather than silently replacing their work; the next minute retries with a fresh snapshot. Unchanged normalized states do not write or bump the version. Observed period/clock changes are meaningful, but clients do not count down a football clock locally. Provider state changes do not append per-minute audit records to the current contest partition; commissioner actions retain their audits.

## Scoring and manual control

Final scores resolve winner, frozen spread and total. Halftime uses complete first-two-quarter line scores only after halftime/third quarter/final evidence. First-score detection requires the opening play sequence and a recognized touchdown, made field goal or safety with a cumulative score change. It identifies the scoring team from scores rather than offensive possession, including defensive touchdowns. Partial/ambiguous feeds stay unresolved; a previously established first score survives temporary play-data unavailability. A first-play kickoff-return score without the expected opening 0–0 record may require manual entry. In ambiguous cases, enter the fact as commissioner rather than infer it.

Commissioner results entry creates a whole-game override (including any first-score/halftime fields). It remains authoritative until removed. To return a game to the latest provider state, select it, enter a reason and choose Remove override and use CFBD. Removing an override before any provider observation returns the game to unresolved. Finalization remains explicit and requires all games and propositions to be resolved or explicitly void; it stops automated updates. Corrections after finalization remain unsupported.

The UI shows banked points, the most recent meaningful provider-change time, observed clock/period and override labels. This timestamp is not a last-successful-poll heartbeat. Projections, elimination scenarios and AppSync delivery remain unimplemented; browser refresh polling continues every three seconds.

## Deployment and secrets

`python3 scripts/configure-cfbd.py` stores the key at `~/.config/tailgate/cfbd-api-key`, owner-only. Deployment uses the ignored owner-only `infra/terraform/cfbd-secret.auto.tfvars` and a sensitive Terraform variable. The key is in the poller Lambda environment and encrypted Terraform state, not frontend code, Git, application logs, or the API Lambda environment. Rotating the local key requires updating that ignored deployment variable and applying Terraform.

The poller role is limited to the revised contest's DynamoDB partition and its log group. It has reserved concurrency 1, a 45-second timeout, and no async retries of old observations; the next scheduled cycle is the retry. The CloudWatch error alarm is visible in AWS but has no email/SNS notification action. Partial-data warnings appear in logs and do not trigger the Lambda Errors alarm. CFBD data and service uptime are not guaranteed; manual entry remains the fallback.

## Verification

- 63 tests pass, including mapping validation, missing/final scores, halftime, observed clock, defensive first scores, incomplete feeds, no-write probing, unchanged-cycle suppression, manual override precedence/removal and prohibition on public API provider injection.
- Isolated DynamoDB Local tests exercise provider state persistence along with lock, Reveal and finalization.
- A read-only completed-game check resolved Miami's first touchdown correctly using actual CFBD play data.
- The deployed no-write probe matched all seven scheduled games without warnings and preserved the real contest phase. `python3 scripts/probe-cfbd-poller.py` is the initial pregame verification helper; it does not write results.
- The cloud synthetic rehearsal passed and removed all 93 test records. Real cards and enrollment were untouched.

References: [CFBD games API](https://api.collegefootballdata.com/api/games), [live plays API](https://api.collegefootballdata.com/api/plays), [access tiers](https://collegefootballdata.com/api-tiers).

Final verification: both EventBridge rules are enabled; a normal invocation outside the window returned `outside_window`; the deployed no-write probe still matched seven games without warnings; final Terraform plan reports no changes; published HTML/assets match the build.

## Slate replacement
The commissioner requested a clean restart as `sept12-2026-final`, replacing App State–ECU with Arizona–BYU. The mapping and poller IAM partition were retargeted; the date window remains unchanged. Earlier contest identifiers above describe the prior deployment.
