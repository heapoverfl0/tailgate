# Dependency review — September 9, 2026

Sonatype Guide MCP authentication verified by successful component queries. Registry metadata access also succeeded with network permission. No package installation or build/test execution occurred during this review.

## Exact resolved dependencies

| Package | Version | License | Guide policy |
| --- | --- | --- | --- |
| typescript | 5.9.3 | Apache-2.0 | Pass |
| @types/node | 22.20.2 | MIT | Pass |
| undici-types | 6.21.0 | MIT | Pass |

Guide reported malicious=false and endOfLife=false for all three. Each passed CVSS < 7.0, No Copyleft Licenses and No Malware conditions. These responses do not establish zero vulnerabilities or guarantee safety. @types/node resolved above the originally proposed 22.18.0 because the manifest permits compatible upgrades; the exact resolved version was separately checked.

The lockfile was generated with --package-lock-only --ignore-scripts --no-audit. All external artifact URLs point to the configured Sonatype registry, with integrity hashes recorded. No external package was marked hasInstallScript in the lockfile; package archive contents have not been inspected.

A subsequent npm audit --package-lock-only returned seven low-severity Component not found notices, all for private local @tailgate workspace packages. These are unavailable-component notices, not identified security vulnerabilities. No external dependency findings were returned. The audit exited 1 due to those notices; do not describe it as a clean zero-finding audit.

Next installation should use npm ci --ignore-scripts to preserve the audited dependency graph and suppress lifecycle scripts. Recheck Guide whenever dependencies change. Build and tests are still pending.

## Installation and validation — September 9, 2026

After user approval, npm ci --ignore-scripts --no-audit --no-fund installed the reviewed lockfile successfully (three external packages and seven local workspace links). npm test ran the TypeScript build and all six tests successfully. This supersedes the pre-install status above. No cloud resources or GitHub repository were created.
