# Browser deployment — September 11, 2026

Tailgate is hosted at https://djhbbw57tyj22.cloudfront.net in the personal AWS setup. Its S3 bucket is private; only the specific CloudFront distribution can read frontend objects. Public access blocks, bucket-owner ownership, AES256 encryption and a non-TLS deny policy are configured. CloudFront redirects page requests to HTTPS and serves `/api/*` through the existing API Gateway origin over HTTPS. API requests forward cookies and Origin while replacing Host for API Gateway. Caching is disabled for both behaviors initially, including all authenticated API responses.

A Content Security Policy restricts scripts/styles/connections to the same origin, disallows raw plugin content and framing, and permits the inline data-URL favicon. HSTS, nosniff, frame denial and no-referrer headers are set. No work account/profile configuration was changed.

The initial hosting apply added eleven resources and updated Lambda's APP_ORIGIN, with no deletions. A follow-up removes the superseded generated JS bundle and updates index.html. S3 stores only the built public HTML/CSS/JS files. No source maps or deployment secrets are included. Future asset rollouts currently replace the prior bundle; this is an initial deployment workflow rather than a versioned zero-downtime release system.

## Commands

From the project root:

- `npm run build:web` — frontend type-check and production build.
- `npm run package:api` — API build/package; the dependency traversal excludes React, React DOM and Vite from the ZIP.
- `python3 scripts/terraform.py foundation plan -out=web.tfplan` — review changes with isolated personal authentication.
- `python3 scripts/terraform.py foundation apply web.tfplan` — apply that reviewed plan.
- `python3 scripts/smoke-api.py` — discovers web_url from personal state, then exercises the actual CloudFront → API Gateway → Lambda → DynamoDB path and removes its synthetic data.

The cloud HTTPS smoke passed health, login/rejection, Origin rejection, approval, secure session cookies, save, conflict, Submit and own/public/commissioner/other-participant pick privacy. It removed 77 synthetic records. Browser testing of the local frontend additionally exercised the full join/approval/card flow, reload persistence and a 390px mobile layout without horizontal overflow. See the [web app notes](../apps/web/README.md) for boundaries.

The real September 12, 2026 contest is seeded and publicly readable: [contest setup and sources](../contests/README.md). Contest creation remains available through the authenticated API; UI curation, a separate team display-name catalog, Reveal, Live, AppSync, CFBD and poller scheduling are still outstanding. M0 is not complete.

Reference: [AWS CloudFront private S3 access](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html).

Final verification: public HTML and both referenced assets exactly match the local production build; expected security headers are present; direct anonymous S3 object access returns 403; the deployed browser reports no warnings/errors; the final Terraform plan reports no changes. Local rehearsal servers were stopped after verification.
