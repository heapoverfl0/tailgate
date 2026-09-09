> Historical reconstruction, superseded by the original root-level specification. Do not use as implementation authority.

# Product and game design

Recovered from “Create Pick Em Format” (6a987b53-d554-83ea-964e-648879267a47), September 8, 2026. This consolidates the readable specification and later decisions; it is not an exported copy of the original v0.2 document. See reference/product-conversation-excerpt.md for the recovered original text, which ends partway through section 18.

## Format

Typically 4–12 participants; aim to support 2–20. Mobile web with a shared display and remote participation. Persistent Player identity is separate from weekly ContestParticipant attendance (ON_SITE or REMOTE); attendance never affects scoring.

The card has 15 selections plus a final-score prediction:

| Section | Selections | Scoring |
| --- | --- | --- |
| Confidence | Six straight-up winners | Unique confidence values 1–6; correct picks earn their value (21 maximum) |
| ATS | Three sides against frozen spreads | Win 2, push 1 (6 maximum) |
| Upset Special | One of roughly 4–6 curated underdogs, or NO_UPSET | Curated values 2–6; NO_UPSET earns guaranteed 1 |
| Main Event | Winner, first team to score, first score type, halftime leader, total over/under | One point each (5 maximum) |

Main Event teams are configurable; Georgia Tech–Tennessee is the original example. First score choices are TD/FG/Other; halftime includes Tie. Maximum total is 38 when the largest upset is worth 6. Exact moneyline tiers remain deferred. Betting lines are captured contest data with source and timestamp and freeze when the contest opens. Overlap between regular categories is allowed but variety is preferred; Main Event normally stays separate.

Rank by total points, then lowest combined absolute error between predicted and actual Main Event team scores. Remaining ties produce co-champions. Skip unavailable tiebreak criteria.

## Joining, picks and privacy

QR code/short code opens a contest. A join request requires commissioner approval and attendance assignment; pending requests expire at lock. Browser sessions remember identity; server storage owns picks. No conventional participant accounts are required.

Use a single global lock. Before lock, picks autosave and may be changed after Submit. Submit expresses readiness, not immutability. Keep revision history and audit commissioner-assisted changes. Commissioner status alone must not expose secret picks.

Incomplete cards remain valid: valid completed selections score; missing/invalid selections score zero. A full-card save must support incomplete drafts; complete confidence cards use 1–6 exactly once. Precise duplicate-confidence treatment in incomplete cards needs an explicit contract before implementing writes.

At lock, freeze all picks and start Reveal. Own cards remain visible; everyone else's data is embargoed until the relevant Reveal step. Enforce the embargo in API responses. Post-lock corrections, if added, are exceptional and audited.

Unresolvable same-day propositions, canceled/postponed games, and void selections award zero. ATS pushes award one. Do not infer unspecifed Main Event total-push behavior; settle it before implementing that resolver.

## Experience

PREGAME → REVEAL → LIVE → MAIN_EVENT → FINAL. Pregame emphasizes completion, QR entry, countdown and commentary without secret picks. Reveal is paced, clusters interesting facts, and supports remote browsers. Exact director weights/timing remain deferred.

Live shows actual points, projected points, remaining potential and individual game exposure. Every active game remains visible; the most consequential game gets detail. Feature selection considers closeness, urgency, disagreement, stakes and leaderboard effects, with stickiness and commissioner override.

Main Event emphasizes resolved props, standings, elimination and paths to winning the entire contest. Final celebrates champion(s), standings and superlatives; historical player stats follow later.

## Domain decisions from the later discussion

Game → Proposition → Pick → Scoring Rule are separate concepts. Proposition status is UNRESOLVED/RESOLVED/VOID; pick result is PENDING/WIN/LOSS/PUSH/VOID. Resolve and bank immediately; source corrections recalculate, without a provisional state.

PROJ means banked points plus currently implied outcomes of live games only. Unstarted games contribute nothing. Remaining potential is separate. Outcome analysis considers the whole contest and must respect correlated propositions from the same game.

Provider state is authoritative unless an explicit commissioner override supersedes it. Display the latest observed game clock, never a browser-simulated countdown. Clock-only changes count as updates. Teams are data, never domain enums.
