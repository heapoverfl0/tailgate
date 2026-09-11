# Tailgate AWS foundation

Target: personal AWS project account **965984382163**, **us-east-2**. Both provider configurations enforce `allowed_account_ids`. The S3 backend template independently enforces the same account. This is the state/database foundation, not yet the complete API deployment.

## Personal authentication boundary

These configurations explicitly select profile `tailgate-personal` from:

- `~/.config/tailgate/aws/config`
- `~/.config/tailgate/aws/credentials`

Those files have not been created or populated. Never use the work SSO profiles in `~/.aws`, change shared defaults, or copy work credentials. Establish personal short-lived authentication separately, then verify its account ID before any account-backed plan. Do not create long-lived keys or paste credentials into chat to satisfy this scaffold.

When running credentialed Terraform, use a dedicated child-process environment that removes inherited AWS credentials, web-identity/container credential settings, endpoint overrides, and Terraform CLI argument overrides. Set the dedicated file paths/profile explicitly for the process; keep metadata credential fallback disabled. The provider's account allowlist is defense in depth, not a substitute for isolating credential discovery. Account-backed commands are pending the personal authentication setup.

## Stacks

`bootstrap/` creates a private, versioned, encrypted S3 bucket for state. It blocks public access, disables ACL ownership sharing, denies plaintext transport and prevents accidental destruction. It initially uses local state; keep that state private, backed up and outside Git. Do not delete it after creating the bucket. A subsequent migration can put bootstrap state into the bucket under a separate key once the bucket exists.

The main stack creates the on-demand DynamoDB table with PK/SK keys, application-compatible TTL, point-in-time recovery, encryption and deletion protection. Terraform also prevents accidental destruction. Backups and storage incur charges; no resources have been provisioned yet.

Remote state uses S3 lockfiles (`use_lockfile`), so a separate DynamoDB lock table is unnecessary. Copy `backend.hcl.example` to ignored `backend.hcl`, replacing `HOME` with an absolute home directory path. Do not put secrets in backend arguments or files.

## Validation and deployment sequence

1. Review the pinned HashiCorp AWS provider and its dependencies before downloading it. Sonatype Guide did not recognize its generic coordinate; no clean audit or transitive coverage is claimed.
2. Initialize each stack and retain its generated `.terraform.lock.hcl`; use `terraform init -backend=false` for initial main-stack schema validation. Neither stack has been initialized yet.
3. Run `terraform validate` and review provider/schema findings. `terraform fmt -check -recursive` is available without provider installation.
4. Configure isolated personal authentication, verify account **965984382163**, then create/review a bootstrap plan. Apply only after the concrete changes and costs have been reviewed.
5. Initialize the main stack using `terraform init -backend-config=backend.hcl`, then create/review its plan before apply.

The local Terraform executable is 1.11.4; AWS provider metadata was pinned to 6.64.0. Formatting passed. Provider-schema validation, lockfile generation, AWS credential validation, planning and deployment remain pending. No work profile or AWS API was accessed while writing these files.

Next infrastructure slice: Lambda ZIP packaging, commissioner secret handling, least-privilege API role, Lambda, API Gateway and CloudWatch logs. Frontend hosting, realtime and the poller schedule follow their implementation. Terraform must coexist with AWS-managed project policies and roles; do not modify AWS-managed roles or enable account-wide advanced features as a workaround without reviewing the need.

References: [AWS provider authentication](https://registry.terraform.io/providers/hashicorp/aws/latest/docs), [S3 state backend](https://developer.hashicorp.com/terraform/language/backend/s3), [AWS projects](https://docs.aws.amazon.com/accounts/latest/reference/sign-up-for-aws.html).
