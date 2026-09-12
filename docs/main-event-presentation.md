# Main Event participant presentation

Implemented from section 6 of the root ASCII mockups. The participant MAIN_EVENT phase shows the observed score, authenticated player's rank/points/projection, all five personal picks with explicit correct/missed/pending/void labels, proposition-decided count, score prediction, day standings with YOU, and the server's winning-path status/example. Public spectators see standings and a recovery prompt, never a guessed identity. The authenticated card DTO now includes its participantId; a regression check verifies distinct players receive their own IDs. Scoring remains server-owned.

The complete public cards and game results remain in an expandable section. Commissioner result controls and session recovery remain available. The old frozen card editor and completion crew are omitted in Main Event. Shared display and Final retain their existing presentation.

The outcome model returns one possible winning finish, not exhaustive necessary conditions. The UI labels it accordingly and states the current-facts / 200-point bound. NO_PATH is qualified rather than claiming unconditional elimination. Corrections can change paths. Unknown scores are dashes, and observed clocks are not simulated.

Verification: 74 tests and TypeScript/Vite builds pass. Browser preview uses fictional results and the real domain standings function, with player and spectator rendering checked. The participant layout has no horizontal overflow at a 390px viewport (375px content width with scrollbar). The fictional fixture includes correct, missed and pending picks, three of five propositions decided, and ALIVE/NO_PATH domain outcomes. No dependencies added. This change and the commissioner runbook await deployment approval; cloud data was not modified.
