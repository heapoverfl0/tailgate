# Pregame shared presentation

Implemented section 2 of the ASCII mockups: title/countdown, submitted card count and individual completion, seven-game slate with category overlap/frozen spread and total, completion-based commentary, and persistent existing QR/code. Only ACTIVE participants count. No private picks enter this view. Near lock text escalates at five minutes and color at one minute; at zero joining/QR are hidden while the server transitions phase. The existing polling and server lock remain authoritative.

Kickoff times are absent from the current configuration contract and are not invented. QR is shown only when the existing manifest matches the full participant URL. This pass does not alter participant editing or Reveal presentation. Commentary is derived from current completion, not invented history.

Verification: 74 tests and builds pass. Rendering checks cover formatted countdown and hidden QR at the deadline. The synthetic crew preview was visually reviewed. No dependencies or cloud mutations. Deployment pending.
