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

## AWS SDK review — September 10, 2026

Added exact versions @aws-sdk/client-dynamodb 3.1129.0 and @aws-sdk/lib-dynamodb 3.1129.0 to the persistence workspace. Resolved metadata with --package-lock-only before installation, then queried Sonatype Guide for all 34 external packages in the lockfile (31 new plus the original three). Every query succeeded and returned policyCompliance.compliant=true, malicious=false and endOfLife=false. All passed the configured CVSS < 7.0, No Copyleft Licenses and No Malware checks. No package was marked hasInstallScript in the lockfile. Installed with npm ci --ignore-scripts --no-audit --no-fund.

Exact versions and raw component results are preserved in [sonatype-sdk-review.json](sonatype-sdk-review.json). This is a policy check, not a zero-vulnerability guarantee or a source/artifact audit. The registry audit was not rerun for this change; Guide checked the complete resolved graph.

## DynamoDB Local runtime review — September 10, 2026

Selected the official AWS-linked image `amazon/dynamodb-local:3.3.1@sha256:ff89bd48ff32cd8d9be5fee8873b65b8854dc408f1afe881be6eb00247bc0dab` (linux/arm64 manifest `sha256:0b8779f3e5a761cb41c7b7610d1a67518964a22a9ca063b4a53c8c312b933485`). Docker Desktop was started. No shared AWS/Git configuration was changed.

Before downloading runtime layers, queried Guide for DynamoDBLocal 3.3.1 and the Docker coordinate. The Maven component passed; Guide could not resolve the Docker coordinate. Registry attestations supplied build provenance but no SBOM. A POM-only traversal produced a candidate dependency graph; 108 exact coordinates were reviewed, with policy failures and one unresolved Ion version range. That traversal was preliminary rather than a Maven-resolved lockfile or an image inventory, and included inherited dependencies which may not ship in the image.

Downloaded the pinned image for static inspection after those checks. Created a container without starting it, copied its library files to a temporary inspection directory, and removed that inspection container. No DynamoDB process or integration test was run.

The actual image differs materially from its published POM: for example, Jackson jars are named 2.21.5 rather than the POM's 2.12.7. Do not apply the preliminary old-Jackson findings to this image. Static inspection found 116 jars; 59 exposed Maven coordinates covering 52 distinct components. Guide results for those coordinates are preserved with all jar hashes and unmapped entries in [sonatype-dynamodb-local-review.json](sonatype-dynamodb-local-review.json).

Confirmed shipped versions include Netty 4.1.135.Final and Jetty 12.1.11. Sixteen identified components fail Guide's CVSS threshold, including jetty-http (8.3), jetty-server (8.7), netty-handler (9.1), and netty-codec-xml (9.8). These are component-version findings; exploit reachability in DynamoDB Local was not established. Separate license flags include Jetty's Apache-2.0 OR EPL-2.0 alternatives; a generic copyleft policy flag does not itself establish a licensing incompatibility.

This review does not cover every repackaged/unidentified jar, the OS, the JRE, or native binaries. No runtime approval is claimed. The downloaded image remains inert in Docker's cache. Integration testing remains pending a decision on the findings.

Proposed limited test, if accepted: a disposable non-root container pinned to this digest, loopback-only ephemeral port, no host mounts or real credentials, read-only root filesystem with temporary scratch space, dropped capabilities, no-new-privileges, bounded memory/CPU, an isolated internal Docker network, and deletion of the test's own container/network after the run. Tests use synthetic data and dummy credentials. This reduces exposure but does not remediate the flagged libraries. The alternative is to proceed to Terraform and test against the managed AWS service after selecting the personal AWS account.

Sources: [AWS local setup](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DynamoDBLocal.DownloadingAndRunning.html), [official image tags](https://hub.docker.com/r/amazon/dynamodb-local/tags), [published POM](https://repo.maven.apache.org/maven2/software/amazon/dynamodb/DynamoDBLocal/3.3.1/DynamoDBLocal-3.3.1.pom).


### Accepted limited local run

The user explicitly accepted the limited local run after reviewing these findings. This acceptance applies to the disposable test runtime; it is not a claim that the dependencies are fixed or suitable for deployment.

The test passed against the pinned DynamoDB Local 3.3.1 image. Docker did not publish ports from the internal network on this host, so the successful run used the stronger `--network none` setting with a loopback-only host relay over `docker exec` stdin/stdout. The small Java relay connects only to port 8000 inside the container. The container ran as its non-root user, with no host mounts or real credentials, a read-only root, dropped capabilities, no-new-privileges, 512 MiB memory and one CPU. A 128 MiB temporary filesystem permits loading the bundled SQLite native library. No additional runtime artifacts were downloaded.

All temporary containers/networks from setup attempts were removed; the successful test's container and host relay were also removed. The pinned image remains cached for repeat testing. Docker Desktop remains running; no shared Docker defaults, AWS profiles or Git authentication settings were changed.

The checked-in `scripts/test-dynamodb-local.py` reproduces this isolation using an already cached image and installed JDK/Python/Docker. It does not pull images. The underlying dependency findings and unidentified-library coverage gaps remain applicable on future runs.
