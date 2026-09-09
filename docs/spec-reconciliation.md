# Original-spec reconciliation

Reviewed both supplied original Markdown files in full on September 9, 2026. Original files remain unchanged. Product rules take precedence for behavior; architecture v0.2 defines implementation contracts. Historical reconstructions under docs/reference are not authoritative.

## Corrected assumptions

- Product sections 7.4 and 9 exclude Georgia Tech/Tennessee from Confidence, ATS and Upset; this is a requirement, not a curation preference.
- Product section 7.3 supplies working upset tiers: +100–199 = 2, +200–299 = 3, +300–449 = 4, +450–699 = 5, +700 and above = 6. Values can be adjusted for the slate and freeze at open. NO_UPSET is guaranteed 1.
- Product sections 1 and 4.2 target a core of 4–6 with flexibility for about 12 and a roughly 2–4 minute Reveal. The reconstructed size/timing notes were less precise.
- Product section 16 requires historical result persistence from the first contest; only expanded career analytics are later work.
- Architecture section 26 specifies join-request secrets, one-time approved session exchange, HttpOnly Secure SameSite=Lax participant cookies and hashed session keys. These mechanics are no longer open design questions.
- Architecture section 24.2 permits missing scores, period and clock. Starter GameState now follows that contract and includes optional possession, situation and provider update timestamp. Do not fabricate 0–0 scores for unavailable data.
- Architecture section 27 requires structured error objects. Starter 404 and local 500 responses now use code/message envelopes.

## Starter boundaries

Existing scoring helpers agree with confidence, ATS, one-point Main Event and score-error rules, but are not a complete scoring engine. NO_UPSET, proposition resolution, card validation, projection, correlated outcomes and finalization remain unimplemented. A non-ATS PUSH currently returns zero in the low-level helper; this does not settle how a Main Event total push should resolve.

ContestSummary and the public demo read are development-only summary contracts, not the complete Contest or a production read model. The small repository and provider interfaces are scaffolding, not full implementations of section 28. No authentication or secret pick data exists in the fixture. The poller is inactive. React, DynamoDB, realtime and Terraform implementation have not started. Add the packages/realtime boundary described in section 5 when implementing publishing.

## Remaining implementation decisions and source gaps

- Architecture 25.2 illustrates a revision header; 27.1 uses expectedCardRevision in JSON. Use the explicit 27.1 body contract as the implementation baseline and document any future header support.
- Draft autosaves must allow valid partial cards. Submitted cards must enforce six unique confidence values. Specify duplicate-confidence handling for incomplete cards at lock, and clearing after submission, before implementing writes.
- Define a total-push representation and same-game correlated outcome constraints before scoring/outcome resolution. Avoid inferring a domain result from the helper alone.
- Scoreboard GameState lacks first-scoring-play and halftime snapshots. Extend the provider/domain boundary explicitly after verifying CFBD coverage; current scores alone cannot resolve those props reliably.
- Specify atomic lock conditions, join exchange retry recovery, active-contest lookup, AppSync authorization and the Saturday timezone/window during their implementation.
- The converted architecture file has collapsed headings/code and apparently empty sections 10, 15, 21 and 23, plus no physical key table under section 25. Section 28 references shapes such as ContestSnapshot without defining them. Preserve the supplied text, use surrounding explicit contracts, and record additional design decisions as implementation notes rather than claiming they were in the original.

## Verification

No dependencies added or changed. Existing API/scoring tests and TypeScript build must pass before the initial commit. The API regression test now verifies the structured error envelope.
