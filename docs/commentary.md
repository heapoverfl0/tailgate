# From the Cheap Seats

The first commentary engine is rule-based and server-generated. Reveal rules cover lock, consensus, lone wolves, No Upset, six-point confidence and Main Event introductions. Live rules prioritize a six-point pick currently trailing, then current banked-point leaders/ties. Final commentary uses authoritative champion IDs, including shared championships.

Reveal commentary receives only the already-filtered Reveal DTO and public configuration. No hidden cards, predictions or history cross that boundary. Pregame game-day responses omit commentary. Full standings commentary runs only after public unlock. React renders names and teams as text, not HTML.

A single stable line appears on participant and shared displays. Clock-only refreshes do not rotate lines or repeat announcements. Current conditions determine eligibility; the engine does not invent lead changes, elimination, probabilities or historical movement. There is no timer rotation, persistent cooldown/history, editable tone setting or external AI service in this first version. Those can follow the dedicated demo.

Verification: 73 unit/API/repository tests pass. Tests cover Reveal-hidden-choice independence, tied/live-score handling, clock stability and final/shared champions. The local shared-display rehearsal showed a six-point trailing joke for fictional players under a simulated-scores title. No dependencies or infrastructure permissions were added.

Deployment completed after explicit user approval. The cloud rehearsal passed commentary assertions throughout Reveal and the final champion, as well as recovery, live scoring, corrections and finalization. All 136 synthetic records were removed. Published JS/CSS match the tested build. The real revised contest remains PREGAME without a public board or premature commentary; real picks and enrollment were unchanged.
