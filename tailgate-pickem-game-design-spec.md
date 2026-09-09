# Tailgate Pick'em --- Product & Game Design Spec

**Status:** Current living product/game-design specification\
**Purpose:** Define the contest rules, participant experience,
shared-display experience, scoring, Reveal, Live Mode, Main Event, Final
Mode, and product behavior. Technical implementation belongs in the
separate Architecture Spec.

## 1. Product vision

Tailgate Pick'em is a small, personality-driven college-football pick'em
game designed first for an all-day Georgia Tech tailgate before Georgia
Tech vs. Tennessee. The core group is expected to be roughly 4--6
participants, with flexibility for about 12 and support for remote
participants.

The app should feel like a **smart-ass tailgate commissioner**, not a
sportsbook or office pool. Trash talk, group dynamics, disagreement,
confidence, and contest implications are first-class parts of the
experience.

The initial event is tailgate-first, but the product should not be
architected so tightly around one physical tailgate that future fully
remote contests are impossible.

## 2. Locked product principles

1.  **Tailgate-first without painting into a corner.** v1 is
    specifically for this Georgia Tech tailgate, while known future
    boundaries should be abstracted where useful.
2.  **Every contest feature works from a browser without the TV.** The
    shared display enhances the in-person experience but is not
    required.
3.  **Game data is provider-abstracted.** Automatic live scores are v1,
    but scoring and UI consume normalized internal game state.
    Commissioner manual override/fallback remains available.
4.  **TV and phone are coordinated surfaces, not responsive copies.**
    Shared display is public, glanceable, and presentation-oriented.
    Phone/browser is personal, interactive, detailed, and controllable.
5.  **Live Mode does not tell users what is happening in football games;
    it tells them what those games mean for the contest.**
6.  **The server owns contest truth.** Clients do not independently
    calculate authoritative standings, grading, elimination, or other
    contest state.
7.  **Prefer fewer moving parts, easy deployment, and real-time
    presentation updates.**

## 3. Core experiences

There are two primary surfaces:

-   **Participant phone/browser:** join, identity, pick card, own
    status, leaderboard, public picks after Reveal, Main Event status,
    and personalized outcome information.
-   **Shared display/TV:** large-screen presentation and dashboard
    experience with contest modes, commentary, standings, Reveal, and
    Live implications.

There is no native app requirement. The participant experience is a
mobile-first browser web app.

## 4. Contest modes

The contest progresses through:

**Pregame → Reveal → Live → Main Event → Final**

### 4.1 Pregame

Purpose: collect picks while building anticipation.

Shared display includes:

-   contest branding
-   global lock countdown
-   participant completion state
-   names and On Site / Remote indicators
-   rotating commentary
-   slate with kickoff/category/frozen betting lines
-   persistent QR code/game code
-   OPEN state

No participant's selections are public before lock.

Participant phone shows a compact pick-card summary such as:

``` text
WEEK 2 PICK 'EM
Locks in 1:11:58

YOUR PICKS
Confidence       0 / 6 →
Against Spread   0 / 3 →
Upset Special    —     →
Main Event       0 / 5 →

0 / 15 selections complete
```

Picks autosave. Sections can be completed in any order. "Submit" means
the card is complete, but the participant may continue editing until
global lock.

Countdown presentation escalates approximately at 30 minutes, 10
minutes, 5 minutes, and 60 seconds. At zero the server freezes picks.

### 4.2 Reveal

Reveal begins after global lock and is a signature feature rather than
simply making a table visible.

Typical arc:

1.  Lock splash
2.  Consensus picks
3.  Disagreements / lone wolves
4.  Upset Special / Coward's Point
5.  Cold feet / revisions
6.  Main Event board
7.  Full picks unlock

The Reveal should generally last about 2--4 minutes and be data-driven.

**Do not reveal information until the presentation uses it.** Picks are
frozen at lock but remain under a Reveal embargo. On-site phones show
their own card and Reveal-in-progress state. Remote participants receive
the synchronized browser Reveal. After the final Reveal card, all picks
become public simultaneously.

Closing language can be in the spirit of:

> THE PICKS ARE PUBLIC --- Let the excuses begin.

Interesting-fact detection and presentation ranking are separate
concerns. A conceptual Reveal score is:

``` text
Reveal Score = Rarity + Stakes + Conflict + Narrative + Recency − Redundancy
```

The director should cluster related facts, avoid repetitive jokes, and
create an arc rather than simply sorting descending scores.

### 4.3 Live

Live Mode is a **secondary-screen companion** while actual football is
on the main TV.

Its mission is:

> **Live Mode does not tell you what's happening in football games. It
> tells you what football games mean for our contest.**

Persistent content includes:

-   actual leaderboard
-   projected leaderboard
-   active contest games
-   individual rooting interests and picks
-   confidence / ATS / Upset exposure
-   points at stake and implications
-   biggest swing
-   commentary
-   upcoming games
-   subtle contest identity

After lock, the join QR code is no longer a prominent element.

#### Projected standings (PROJ)

Projected points are:

**banked points + points implied by the current state of games that are
currently live**

Unstarted games contribute zero to PROJ. Maximum/potential points
remaining are tracked and displayed separately.

Example:

``` text
             PTS   PROJ
1 Sarah      12     27 ↑2
2 Hudson     11     25 —
3 Zach       10     24 ↑3 REMOTE
4 Dave       10     19 ↓3
```

#### Live game clock

The app displays the **latest observed provider clock**. A clock-only
provider change is a meaningful game-state update and may be
persisted/published. The browser does **not** locally simulate a
countdown between observations because it does not know whether the game
clock is actually running.

#### Individual exposure over aggregates

At the expected group size, Live Mode should show participant names and
values rather than hiding useful information behind aggregate
percentages. If a game appears in multiple contest categories, show all
relevant exposure.

#### Multiple simultaneous games

**Every live contest game remains visible; detail is allocated according
to consequence. Breadth is guaranteed, depth is earned.**

Suggested hierarchy:

1.  Featured / Game to Watch --- full detail
2.  Secondary games --- meaningful exposure
3.  All other live contest games --- minimum score/status/categories
4.  Phone drill-down --- deeper personal detail

#### Live Director / Contest Impact

A game's impact is conceptually:

``` text
Impact = closeness × urgency × disagreement × points at stake × leaderboard leverage
```

with additional weight for proposition overlap. Inputs can include
closeness, time remaining, disagreement, confidence points, ATS split,
upset exposure/value, proposition count, and leaderboard movement.
Blowouts and games where everyone made the same choice should lose
weight.

Use hysteresis/stickiness so the featured game does not thrash. A
challenger should become featured only when meaningfully more
consequential. Commissioner manual feature control is allowed.

### 4.4 Main Event

The group leaves the tailgate to attend Georgia Tech vs. Tennessee in
person, so Main Event becomes primarily **phone-first**.

It should answer:

1.  What has been decided?
2.  Where do I stand?
3.  Can I still win, and what do I need?

Show decided and unresolved Main Event propositions, day leaderboard,
alive/eliminated state, and personalized "HOW YOU WIN" information.

The outcome/elimination engine is a general contest engine rather than a
Main Event-specific feature. It evaluates unresolved contest outcomes
and determines whether first place remains possible. Because the
unresolved state space is small, enumerate combinations rather than
building clever symbolic formulas. The tiebreak can matter.

### 4.5 Final

Final Mode finalizes scoring and presents:

-   winner reveal
-   final standings
-   unofficial superlatives
-   historical result persistence

Formal scoring recognizes **first place only**. Superlatives are
entertainment, not additional formal winners.

Examples include:

-   TAILGATE CHAMPION
-   CELLAR DWELLER
-   UPSET PROPHET
-   CONFIDENCE WITHOUT COMPETENCE
-   CAPTAIN HINDSIGHT
-   SHEEP

## 5. Participants, attendance, and joining

Attendance is weekly contest metadata, not a permanent player property
and has no scoring effect.

``` text
ContestParticipant
  playerId
  contestId
  attendance: ON_SITE | REMOTE
  status: ACTIVE | NOT_PLAYING
```

Remote participants use the same contest and same picks. Attendance
primarily informs presentation and commentary.

### Join flow

1.  Scan QR / open contest link
2.  Enter name and REQUEST TO JOIN
3.  Wait for approval
4.  Commissioner approves or denies
5.  Commissioner marks participant On Site or Remote
6.  Approved participant receives access to the pick card
7.  Pending requests expire at lock

Browser identity uses a durable opaque session token with server-side
picks. The commissioner can reauthorize a participant if necessary.

## 6. Pick privacy, lock, and editing

There is one global commissioner lock time.

Before lock:

-   picks are editable and private
-   participant sees their own picks
-   participant sees everyone's completion state, but not selections
-   commissioner has no privileged visibility into selections
-   commissioner may assist/edit before lock, with visible/audited "Last
    edited by Commissioner" metadata
-   revision history is retained for commentary

At lock:

-   all selections freeze simultaneously
-   completed selections remain valid
-   unanswered selections score zero
-   an incomplete card does not invalidate completed picks
-   Reveal embargo begins

Post-lock emergency correction is possible only as an explicit audited
commissioner override.

## 7. Scoring system

Maximum score: **38 points**.

### 7.1 Confidence --- 21 points maximum

-   6 straight-up winner games
-   participant picks the winner of all six
-   confidence values 1--6 must each be used exactly once
-   correct pick earns its confidence value
-   maximum = 21

A missing or invalid winner/confidence pairing scores zero.

### 7.2 Against the Spread --- 6 points maximum

-   3 ATS games
-   2 points each
-   lines are frozen when the contest opens
-   store line source and captured timestamp
-   ATS push = 1 point

### 7.3 Upset Special --- up to 6 points

The commissioner curates roughly 4--6 underdogs. Each participant
chooses one upset candidate or chooses **NO UPSET**.

Moneyline/implied likelihood calibrates a simple point value. Exact
thresholds can be adjusted for the slate, but the working scale is:

  Moneyline        Points
  -------------- --------
  +100 to +199          2
  +200 to +299          3
  +300 to +449          4
  +450 to +699          5
  +700+                 6

**NO UPSET / Coward's Point = guaranteed 1 point.**

Betting markets calibrate difficulty only; the product is not a wagering
app. Odds and point value freeze at contest open.

### 7.4 Georgia Tech vs. Tennessee Main Event --- 5 points

One point each:

1.  Winner --- Georgia Tech / Tennessee
2.  First team to score --- Georgia Tech / Tennessee
3.  First scoring play --- TD / FG / Other
4.  Halftime leader --- Georgia Tech / Tennessee / Tie
5.  Game total --- Over / Under a preset frozen line

Predicted final score is a tiebreak only.

Georgia Tech vs. Tennessee is excluded from Confidence, ATS, and Upset
categories.

## 8. Tiebreak

Use predicted Georgia Tech/Tennessee final score:

``` text
|predicted GT - actual GT| + |predicted TENN - actual TENN|
```

Lowest combined error wins the tiebreak. If still tied, participants are
co-champions.

If a tiebreak criterion becomes unavailable because the relevant
game/proposition cannot be resolved, skip that criterion.

## 9. Game overlap

The same real football game may appear in multiple contest categories
because the propositions differ. The commissioner should generally favor
slate variety, but overlap is valid.

**Each live game panel shows picks relevant to every contest proposition
attached to that game.**

Georgia Tech/Tennessee remains excluded from the other categories.

## 10. Cancellation and postponement

**If a game/proposition cannot be resolved that day, it is void and
scores 0 points.**

A postponed game is treated as canceled for that contest even if it is
played later. ATS pushes remain worth 1 point.

## 11. Game/proposition/pick state model

Do not conflate football game state, proposition resolution, and
participant grading.

### Game state

``` text
SCHEDULED
IN_PROGRESS
FINAL
CANCELED
POSTPONED
```

### Proposition state

``` text
UNRESOLVED
RESOLVED
VOID
```

### Participant pick result

``` text
PENDING
WIN
LOSS
PUSH
VOID
```

Example:

``` text
GAME IN_PROGRESS
PROP First team to score RESOLVED → teamId GT
Hudson GT → WIN +1
Dave TENN → LOSS
PROP First scoring play RESOLVED → TOUCHDOWN
PROP Halftime leader UNRESOLVED
PROP Winner UNRESOLVED
```

There is no provisional proposition resolution. Once effective data says
a proposition is resolved, bank it immediately. Provider corrections
trigger recalculation.

For PROJ only, unresolved propositions may have a temporary current
projected outcome, such as the currently leading team for winner or
currently covering side for ATS. The official proposition remains
UNRESOLVED until it can truly resolve.

## 12. Teams, games, propositions, and outcomes

Teams and games are data, not hard-coded enums.

``` text
Game
  id
  homeTeamId
  awayTeamId
  status
  homeScore
  awayScore
```

``` text
Proposition
  id
  gameId
  type
  parameters
  status
  resolvedOutcome
```

Finite proposition concepts can use enums such as:

``` text
STRAIGHT_UP_WINNER
AGAINST_SPREAD
FIRST_TEAM_TO_SCORE
FIRST_SCORE_TYPE
HALFTIME_LEADER
GAME_TOTAL
```

Outcomes reference data rather than bespoke enum members:

``` text
resolvedOutcome: { teamId: "clemson" }
```

ATS parameters contain the favored team and spread; the resolved outcome
identifies the side that covered. Other finite concepts such as score
type and total side may use enums such as `TOUCHDOWN`, `FIELD_GOAL`,
`OTHER`, `OVER`, and `UNDER`.

Conceptually:

``` text
GAME — what happened?
 ↓
PROPOSITION — what question?
 ↓
PICK — what selected?
 ↓
SCORING RULE — what is it worth?
```

Confidence is a straight-up winner proposition plus confidence scoring
metadata. Upset is an outright-winner choice plus eligibility/value
treatment.

## 13. Pick slots

The pick card uses a small **slot** abstraction in addition to
propositions.

Most slots map 1:1 to a proposition. The Upset Special does not: it is
one required participant choice across several different games plus
`NO_UPSET`. Modeling the user-facing requirement as a slot prevents
`Proposition` from becoming a cross-game object whose resolution depends
on what a participant selected.

A slot therefore answers "what must the participant fill in?" while a
proposition answers "what objective football question can be resolved?"

## 14. Provider data and commissioner override

Provider data is authoritative by default, but the commissioner may
explicitly override it.

``` text
Provider State
     ↓
Commissioner Override (optional)
     ↓
Effective Game State
     ↓
Scoring Engine
```

Do not mutate provider state to represent an override. Layer the
override on top. The override remains authoritative until removed.

## 15. Commentary and personality engine

Commentary is generated from game state, picks, standings, attendance,
and pick history.

Potential facts/events include:

``` text
LAST_PLAYER_WITHOUT_PICKS
LONE_WOLF
HIGH_CONFIDENCE_PICK_LOSING
SIX_POINT_PICK_LOSING
PERFECT_SO_FAR
BIGGEST_RANK_CHANGE
IDENTICAL_PICK_CARDS
REMOTE_PARTICIPANT_LEADING
REMOTE_PARTICIPANT_LOSING
LATE_PICK_SWITCH
UPSET_HIT
COWARDS_POINT
ELIMINATED
NEW_PROJECTED_LEADER
```

Tone levels can include **Normal / Spicy / Ruthless**, with this group
expected to favor Spicy/Ruthless.

Example tone:

-   "Zach has more important things to do."
-   "THIS IS EMBARRASSING --- Zach isn't even here and he's beating all
    of you."
-   "REMOTE WORK ISN'T FOR EVERYONE --- Zach currently sits 12th."
-   "EASY TO SAY FROM HOME --- Zach is the only person taking Florida."
-   "LONE WOLF --- Mike is the only person who picked Auburn. Either a
    visionary or an idiot."
-   "UPDATE: Dave put 6 confidence points on LSU." after LSU falls
    behind.
-   "LET'S SEE WHAT THESE IDIOTS DID." after lock/reveal.

Commentary should respond to circumstances rather than becoming a static
joke list.

## 16. Historical results

Persist historical results from the first contest. At minimum, support
future statistics such as contests played, wins, last-place finishes,
confidence performance, ATS record, and upset performance.

Historical data should not complicate the live contest path; it is
primarily updated/finalized after contest completion.

## 17. Product boundaries intentionally deferred

Do not prematurely generalize into:

-   arbitrary sports
-   arbitrary scoring engines
-   enterprise authentication
-   native mobile apps
-   large-scale public contest hosting
-   microservices
-   Kafka/event-stream architecture

Known future boundaries such as game-data providers, remote
participation, and reusable contest/domain logic should remain cleanly
abstracted.
