# Tailgate Pick’em

A mobile browser contest for a college-football tailgate, with commissioner controls and a synchronized shared display.

## Getting started

Requires Node.js 22.18+ and npm.

```sh
npm ci --ignore-scripts
npm test
npm run build
npm run dev:api
```

The local API listens on http://localhost:3001. Try `/api/health` and `/api/contests/demo`. Its seeded contest is development data and is held in memory.

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
- `packages/domain`: scoring primitives
- `packages/persistence`: repository boundary and development fixture
- `packages/game-data`: provider boundary
- `infra/terraform`: deployment planning notes

This is a tested starting foundation, not the completed M0 deployment. Authentication, joins, card writes, React UI, AWS adapters and infrastructure are still pending. No cloud resources have been created.
