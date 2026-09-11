# API deployment — September 11, 2026

The API is deployed in personal AWS account 965984382163, us-east-2:
https://tmc87s2dwe.execute-api.us-east-2.amazonaws.com/api/health

Terraform added ten resources with no changes or deletions. A follow-up plan reported no drift. Node.js 22 on arm64 runs the existing API service against the protected `tailgate` DynamoDB table. IAM permits only required item/query/transaction actions on that table and writes to the API's log group. API Gateway permits 10 requests/second with a burst of 20; this is best-effort throttling, not a spending cap. Both log groups retain 14 days. Access logs include request ID, route template, status and size, not cookies or request bodies. Application authentication and Origin checks run in Lambda.

## Reproduce

Use `npm run package:api` after the reviewed dependency installation. Packaging performs no downloads, omits development packages and tests, validates installed package versions against the lockfile, and produces a deterministic ZIP. Extracted-ZIP import/handler verification passed.

Use `python3 scripts/terraform.py foundation plan -out=api.tfplan`, review it, then `python3 scripts/terraform.py foundation apply api.tfplan`. The helper discards inherited AWS and Terraform settings, explicitly selects the separate personal config files, verifies the STS account and uses a private process umask. It does not modify shared config or credentials. Bootstrap commands use `bootstrap` instead of `foundation`. Terraform and the isolated CLI paths currently match this Mac's setup.

`infra/terraform/secrets.auto.tfvars` is an ignored, private local file containing independently generated commissioner and signing secrets. Preserve it securely. Terraform marks both sensitive, but they are still present in encrypted remote state and Lambda environment configuration. Do not print plan/state JSON or Lambda environment values into chat/logs. The password is never shipped in frontend assets. Replacing either credential invalidates old commissioner cookies according to service rules.

Run `python3 scripts/smoke-api.py` after building. It discovers the endpoint from verified personal Terraform state, keeps cookies/passwords in memory, creates a uniquely named synthetic contest and removes only its exact contest, player, history and known session keys. The September 11 run passed health, credential rejection, Origin enforcement, commissioner login, approval, secure participant cookies, save, stale revision conflict, Submit, own-card reads and public/commissioner/other-participant privacy. It removed all 77 synthetic records. A process interruption can leave synthetic records; inspect their exact IDs before cleanup. No real contest was seeded.

All 56 existing unit/API/persistence contract tests pass. AWS HTTPS smoke testing supplements the earlier isolated DynamoDB Local scenario.

Frontend hosting is now deployed; see [browser deployment](web-deployment.md). APP_ORIGIN equals the CloudFront origin, and smoke-api.py now tests through that origin. Realtime, scheduled poller, explicit persisted lock transition and game data integration remain outstanding.

References: [Lambda Node.js runtimes](https://docs.aws.amazon.com/lambda/latest/dg/lambda-nodejs.html), [DynamoDB transaction IAM permissions](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/transaction-apis-iam.html).
