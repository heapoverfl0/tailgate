# Tailgate development

Read tailgate-pickem-game-design-spec.md, tailgate-pickem-architecture-spec.md, docs/spec-reconciliation.md and docs/roadmap.md before implementation. The root-level original specs are authoritative; docs/reference contains historical material only. Preserve source provenance and distinguish recovered decisions from new proposals. Keep scoring independent of AWS and UI code. Teams and games are data. Enforce secret-pick visibility on the server. Never commit credentials, Terraform state or real participant sessions. Run npm test and npm run build after behavioral changes. Do not deploy infrastructure or publish a repository unless requested.

## Dependency review

Before adding, upgrading or installing dependencies, use Sonatype Guide to check the exact external package versions, including transitive dependencies. Review and retain the lockfile. Record policy results and limitations in docs/dependency-review.md. Use npm ci --ignore-scripts for reviewed installs; investigate required lifecycle scripts individually. If Guide is unavailable, report that limitation before installing. Keep Sonatype tokens outside the repository.
