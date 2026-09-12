# Implementation status

Source of truth: [Product spec](../tailgate-pickem-game-design-spec.md) and [Architecture v0.2](../tailgate-pickem-architecture-spec.md). See [reconciliation](spec-reconciliation.md) for implementation decisions and source gaps.

## Foundation

- Original specs preserved; reconstructions clearly archived
- Strict TypeScript npm workspace with audited lockfile
- Tested scoring primitives, health/demo read and Lambda/local wrappers
- Optional observed-game fields and structured API error envelopes aligned with v0.2
- In-memory repository, provider boundary and inactive poller stub

## M0 — first deployable slice

1. Completed the pick-card domain milestone: models, configuration validation/freezing, draft/Submit guards, resolution-based scoring and champion selection. See [domain milestone](domain-milestone.md) for decisions and remaining resolver work.
2. Durable local repository and contest create/read are implemented; DynamoDB contest/card adapter and key/transaction contract tests are now implemented; see [DynamoDB milestone](dynamodb-milestone.md). The API now uses explicit repository operations, atomic DynamoDB join/session writes and the configured Lambda entry point. The local database integration scenario now passes against DynamoDB Local. The API is deployed and its HTTPS integration smoke test passes; see [API deployment](api-deployment.md).
3. Commissioner login, join/approval/session exchange, card save/Submit and privacy/concurrency tests now run locally. See [local API milestone](local-api.md). Lambda wiring is implemented; packaging and deployment pass; session recovery remains pending.
4. React/Vite pregame participant, commissioner approval and shared completion views are deployed and browser-tested. See [browser deployment](web-deployment.md). Contest curation, full slate display and later modes remain pending.
5. Local Lambda ZIP builds are implemented and verified. Realtime interface/AppSync wiring remains pending.
6. Add Terraform for DynamoDB, Lambda, API Gateway, S3/CloudFront, AppSync, EventBridge, IAM and secret inputs; validate/plan before authorized deployment.

M0 is not complete. Acceptance includes deployed health, seeded contest reads, login/join, frontend loading and manually invoked poller stub.

## Game-day baseline

The manual lock → staged Reveal → observed result entry → standings → final history flow is implemented and deployed. See [game-day operation and limits](game-day.md). Provider automation, advanced directors and outcome projections remain pending.

## Later milestones

M1: full contest curation, autosave and Submit flows.
M2: global lock, Reveal Director and server-side embargo.
M3: CFBD normalization, overrides, realtime Live views and Live Director.
M4: Main Event resolution and correlated contest outcome engine.
M5: Final, historical results from the first completed contest, presentation polish. Expanded career analytics can follow.

Dependency review and installation succeeded September 9, 2026. The private Terraform state bucket and DynamoDB table are deployed in personal account 965984382163 (us-east-2). Bootstrap state is migrated to S3. API cloud deployment and HTTPS integration checks pass.

The subsequent [CFBD integration](cfbd-integration.md) adds automated scoreboard/play polling and a separate override layer for the revised contest. It supersedes the earlier manual-only/provider-pending status; advanced projections and directors remain pending.


## Projections and Main Event paths — September 11, 2026

Live standings now include banked points, projected points/rank and unresolved pick exposure. After earlier propositions resolve, Main Event example paths include the final-score tiebreak and co-champions. See [projection model](projections.md). This is a bounded Main Event model; full earlier-game correlated potential, advanced directors, AppSync push and expanded historical analytics remain future work.

Commissioner-issued, one-use [session recovery](session-recovery.md) is implemented, preserving existing cards and invalidating prior sessions on redemption. This supersedes the earlier session-recovery-pending note.

The first [rule-based commentary engine](commentary.md) is implemented, tested and deployed following explicit approval. It adds phase-safe Reveal jokes, current live standings/losing-confidence observations and champion lines. Expanded directors, tone controls and persistent commentary history remain pending.

The mockup-based [shared Live presentation](shared-live-presentation.md) is implemented, browser-tested and deployed following explicit approval. The cloud rehearsal passed and its synthetic records were cleaned up. It replaces the stacked shared view with standings, featured game exposure, slate strip and bottom implications/commentary.
