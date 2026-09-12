# Tailgate browser app

React/Vite pregame flow: open a contest using `/?contest=CODE`, request a join, commissioner approval, own-card autosave, explicit Submit and shared completion display (`&display=1`). No picks are rendered in the shared display. React renders supplied text as text; no raw HTML injection or spreading server payloads onto DOM elements.

Run `npm run dev:web` from the repository. Vite binds to 127.0.0.1 and proxies `/api` to the local API on port 3001. Set the local API's APP_ORIGIN to `http://127.0.0.1:5173` and use dedicated local test secrets/data. Never configure the local proxy to bypass production Origin checks. `npm run build:web` type-checks and creates `apps/web/dist` for Terraform deployment.

Public contest status refreshes every 10 seconds and join/approval lists every 5 seconds. This is temporary polling pending AppSync integration. The browser countdown is advisory; API writes enforce lock. Autosaves are debounced and serialized by disabling card inputs during an in-flight save. Errors retain the local draft for retry; revision conflicts display the server's canonical own card with a warning. Unsaved changes trigger a navigation warning. A partial score prediction blocks saving until both scores are entered; absent scores are never inferred as zero.

Join-request secrets are kept in sessionStorage for the current tab until exchanged; participant and commissioner session tokens are HttpOnly cookies. UI state and storage are not authorization. Server responses enforce privacy and session scope.

The first UI does not create/configure contests, provide session recovery, show the full public slate on the shared display, render the Reveal or Live experience, or resolve game results. Team IDs currently serve as choice labels; contest labels and a team display-name catalog need real slate data. Main Event total-push behavior remains a domain decision before result resolution.

Local browser rehearsal verified: contest entry, join, commissioner login/approval, cookie exchange, all 15 selections plus score prediction, autosave, Submit, reload persistence and shared-view exclusion of picks. Mobile verification at 390px showed no horizontal overflow. Synthetic local data is in ignored `.local/ui-smoke.json`.

Confidence controls show available values, disable values used by other games on drafts, and allow clearing draft confidence without clearing the selected team. Submitted cards offer atomic confidence swaps instead, preserving completeness. Availability follows the current draft immediately. Verified with frontend type-check/build and the 56-test existing suite; deployed HTML/JS match the build. No new dependencies.

Shared display includes locally generated QR images for the checked-in contests, the contest code and a direct participant URL (no display parameter). Generate/update them on macOS with `swift scripts/generate-contest-qr.swift` before building; Core Image decodes each generated PNG and verifies its exact target. The manifest only displays a QR when its encoded URL matches the current origin and contest; other contests retain a clickable join link. QR files contain public URLs only, use a four-module quiet zone and require no downloaded dependencies or external QR service. Build and all 56 existing tests passed; deployed shared-display layout and join URLs were browser-verified.

The subsequent [game-day milestone](../../docs/game-day.md) adds staged Reveal, public standings, commissioner result entry and finalization. It supersedes the earlier pregame-only scope statements above.
