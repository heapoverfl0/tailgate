# Tailgate Pick’em

A mobile browser contest for a college-football tailgate, with commissioner controls and a synchronized shared display.

## Getting started

Requires Node.js 22.18+ and npm.

```sh
npm ci --ignore-scripts
npm test
npm run build
cp .env.example .env
# Set COMMISSIONER_PASSWORD and SESSION_SIGNING_SECRET (at least 32 characters) in .env.
npm run dev:api
```

The local API listens on http://127.0.0.1:3001 and saves state in the ignored `.local/tailgate.json` file. Try `/api/health`. Start with an empty store, log in, and create a contest using the [local API workflow](docs/local-api.md). All mutation requests must send the configured `Origin` and JSON content type. The Lambda entry point uses the same service with DynamoDB; it requires TAILGATE_TABLE, APP_ORIGIN (HTTPS), COMMISSIONER_PASSWORD and SESSION_SIGNING_SECRET. It has not been deployed.

## Project map

- [Product & Game Design Spec](tailgate-pickem-game-design-spec.md): authoritative rules and experience
- [Architecture Spec v0.2](tailgate-pickem-architecture-spec.md): authoritative technical design
- [Spec reconciliation](docs/spec-reconciliation.md): corrections and contract gaps
- `docs/roadmap.md`: implementation status and next milestones
- `docs/reference/`: superseded reconstructions and original conversation excerpt
- `apps/api`: framework-independent request router, Lambda entry point, local server
- `apps/poller`: explicitly inactive polling stub
- `apps/web`: frontend implementation boundary
- `packages/contracts`: initial shared types
- `packages/domain`: pick-card models, frozen configuration, validation, scoring and tiebreaks
- [Domain milestone](docs/domain-milestone.md): implemented rules and boundaries
- `packages/persistence`: durable local store and DynamoDB contest/card adapter
- [DynamoDB milestone](docs/dynamodb-milestone.md): transaction behavior and integration limits
- `packages/game-data`: provider boundary
- `infra/terraform`: deployment planning notes

This is a tested starting foundation, not the completed M0 deployment. The durable local API supports login, contest creation, join/approval and card save/Submit. The DynamoDB API adapter and Lambda wiring are implemented. Local DynamoDB integration validation passes. The private Terraform state bucket and DynamoDB table are deployed in the personal AWS account; see [infrastructure status](infra/terraform/README.md). React UI, realtime and API cloud deployment remain pending.
