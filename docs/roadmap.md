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
2. Durable local repository and contest create/read are implemented; DynamoDB keys/transactions and production adapter remain pending.
3. Commissioner login, join/approval/session exchange, card save/Submit and privacy/concurrency tests now run locally. See [local API milestone](local-api.md). Production wiring and recovery remain pending.
4. Implement React/Vite participant and shared-display shell against purpose-built API views.
5. Add realtime interface/AppSync wiring and local Lambda ZIP builds.
6. Add Terraform for DynamoDB, Lambda, API Gateway, S3/CloudFront, AppSync, EventBridge, IAM and secret inputs; validate/plan before authorized deployment.

M0 is not complete. Acceptance includes deployed health, seeded contest reads, login/join, frontend loading and manually invoked poller stub.

## Later milestones

M1: full contest curation, autosave and Submit flows.
M2: global lock, Reveal Director and server-side embargo.
M3: CFBD normalization, overrides, realtime Live views and Live Director.
M4: Main Event resolution and correlated contest outcome engine.
M5: Final, historical results from the first completed contest, presentation polish. Expanded career analytics can follow.

Dependency review and installation succeeded September 9, 2026. Cloud deployment/integration checks remain pending. No AWS resources have been created.
