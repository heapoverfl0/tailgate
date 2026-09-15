# Maintenance mode

Enabled September 15, 2026 after the September 12 contest.

`maintenance_mode` defaults to true in `infra/terraform/maintenance.tf`.
It disables the CloudFront distribution and the default API Gateway endpoint,
sets API and poller Lambda reserved concurrency to zero, and forces the poller
schedules off. Website objects, contest data, backups, and logs are retained.
The public site returns an AWS error rather than a custom maintenance page.
Storage and monitoring charges remain; this is not an account-wide billing cap.

To reopen, set maintenance_mode=false, run the isolated personal Terraform helper
with `foundation plan -out=reopen.tfplan`, review the plan, then apply that plan.
Keep poller_enabled=false until the next contest ID, mappings, and date window
have been configured and reviewed. Enabling the website alone does not enable
CFBD polling. Never use shared work AWS profiles for this project.
