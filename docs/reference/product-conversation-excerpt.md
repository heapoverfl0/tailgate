# Recovered product specification excerpt

Source: Create Pick Em Format, conversation 6a987b53-d554-83ea-964e-648879267a47. Recovered September 8, 2026. The conversation reader truncates this document during section 18; this is not the complete original specification. Later decisions are summarized in ../product.md and ../architecture.md.

Absolutely. Here is **v0.1**, capturing the decisions we've made so far while explicitly separating locked decisions from deferred ones.

:::writing{variant="document" id="58321"}
# Tailgate Pick’em — Product & Game Design Spec

**Version:** 0.1  
**Status:** Living design document  
**Initial target:** Georgia Tech vs. Tennessee tailgate, College Football Week 2

---

## 1. Product Vision

Tailgate Pick’em is a small-group college football pick’em game designed first and foremost to make an all-day football tailgate more entertaining.

The application is not intended to compete with the football broadcast. Its purpose is to make the games more personally consequential by continuously answering questions such as:

- Who picked this team?
- How many points does someone have riding on this?
- What does this score mean for our standings?
- Who just moved into the lead?
- Who needs this comeback?
- Who is still mathematically alive?
- Who made an especially terrible decision?

The desired personality is closer to a **smart-ass tailgate commissioner** than a sportsbook or corporate office pool.

---

# 2. Core Product Principles

## 2.1 Tailgate-first, not tailgate-only

The initial experience is specifically optimized for:

- approximately 4–12 friends
- one shared tailgate
- a main television showing college football
- participant phones
- a laptop or secondary display
- one Main Event attended in person

However, architectural boundaries should avoid making those conditions mandatory.

Future contests may be entirely remote.

Every essential contest feature must therefore work in a browser without a shared television.

The TV enhances an in-person contest; it is not required to run one.

---

## 2.2 Football is the primary screen

The application should not attempt to recreate ESPN or the underlying football broadcast.

During live games:

> **The football broadcast tells us what is happening. Tailgate Pick’em tells us what it means for our contest.**

Live Mode should prioritize contest implications over generic football information.

---

## 2.3 Optimize v1 without painting ourselves into a corner

Do not prematurely generalize the entire application.

However, introduce abstractions at boundaries where future expansion is already clearly anticipated.

Two particularly important boundaries are:

### Game data

Initial/manual and automatic data sources should feed the same internal game-state model.

```text
Sports Data Provider ─┐
                      ├─→ Game Data Service → Scoring / Experience
Manual Provider ──────┘
```

### Presentation

Contest state and presentation content should not assume a television is present.

```text
Contest State
     ↓
Presentation / Commentary
     ↓
TV     Phone     Desktop
```

---

# 3. Participants

Expected initial group size is approximately **4–12 participants**.

The underlying design should comfortably support roughly **2–20** without changing the game format.

Increasing participant count should not require increasing the number of picks.

---

## 3.1 Player vs. contest participation

A persistent person and participation in a particular weekly contest are separate concepts.

Conceptually:

```text
Player
  id
  name
```

```text
ContestParticipant
  playerId
  contestId
  attendance
  status
```

Attendance:

```text
ON_SITE
REMOTE
```

Participation status may also support:

```text
ACTIVE
NOT_PLAYING
```

Attendance is weekly contest metadata, not a permanent characteristic of the player.

Attendance does **not** affect scoring.

It may affect commentary.

---

# 4. Joining a Contest

The participant experience is a **mobile-first browser application**, not a native iOS or Android app.

No installation should be required.

---

## 4.1 QR entry

During Pregame, the shared display should maintain a persistent, unobtrusive:

- QR code
- short contest/game code

Scanning the QR opens that week's contest directly.

---

## 4.2 Commissioner approval

Scanning the QR does **not** automatically add someone to the contest.

A new participant submits a join request.

Example:

```text
WEEK 2 TAILGATE PICK 'EM

Name:
[ Brian ]

[ REQUEST TO JOIN ]
```

The commissioner receives:

```text
JOIN REQUEST

Brian

[ APPROVE ]   [ DENY ]
```

The commissioner determines whether the participant is:

```text
ON SITE
REMOTE
```

Join requests expire when the contest locks.

This allows the QR code to remain publicly visible without allowing arbitrary people to enter the contest.

---

## 4.3 Remembering participants

A participant's browser should remember their identity/session.

Returning from the same browser should normally result in:

```text
Welcome back, Brian.
```

No conventional account, email address, or password should be necessary for the initial application.

Conceptually:

```text
Player
        ↑
ContestParticipant
        ↑
Browser Session / Device Token
```

Browser storage alone should not be the canonical storage for picks or identity.

Losing local browser state must not destroy a participant's picks.

A commissioner should eventually be able to reauthorize a participant on a new device.

Participation approval remains contest-specific even when the application remembers the underlying Player.

---

# 5. Weekly Game Format

The contest contains four scoring sections.

---

## 5.1 Confidence Picks

Select **6 games**.

For every game:

- choose the straight-up winner
- assign a confidence value from **1–6**
- every confidence value must be used exactly once

Correct pick earns its confidence value.

Maximum:

```text
1 + 2 + 3 + 4 + 5 + 6 = 21 points
```

---

## 5.2 Against the Spread

Select **3 games**.

Each participant chooses one side against the frozen contest spread.

Correct selection:

**2 points**

Push:

**1 point**

Maximum:

**6 points**

---

## 5.3 Upset Special

The commissioner curates approximately **4–6 underdogs**.

Each participant chooses exactly one Upset Special.

Larger underdogs are worth more points.

Target range:

**2–6 points**

The precise moneyline-to-point thresholds are intentionally deferred until the actual Week 2 slate can be evaluated.

Participants may instead choose:

### Coward's Point

Take no upset and receive a guaranteed:

**1 point**

Betting-market information is used only to calibrate difficulty. This is not a wagering system.

---

## 5.4 Georgia Tech vs. Tennessee Main Event

GT/Tennessee is treated separately from the normal slate.

It should generally **not** also appear as a Confidence, ATS, or Upset game.

Five one-point propositions:

1. **Winner** — Georgia Tech / Tennessee
2. **First team to score** — Georgia Tech / Tennessee
3. **First scoring play** — TD / FG / Other
4. **Halftime leader** — Georgia Tech / Tennessee / Tie
5. **Game total** — Over / Under a predetermined line

Maximum:

**5 points**

Participants also predict the final score.

Predicted final score is used as a **tiebreaker only** and does not award normal points.

---

# 6. Total Scoring

Maximum available:

```text
Confidence       21
ATS               6
Upset Special     6
Main Event        5
                 ──
Maximum           38
```

---

# 7. Game Overlap

A real football game may appear in multiple contest categories.

For example, a participant may reasonably have:

```text
Confidence:
Tennessee wins

ATS:
Georgia Tech +6.5

Upset Special:
Georgia Tech wins
```

These propositions are not inherently contradictory.

However:

> **The commissioner should generally favor variety across the slate.**

The purpose of the contest is partly to make many games throughout the day interesting.

Overlap is therefore **allowed but discouraged as a curation principle**.

GT/Tennessee should normally remain exclusively within Main Event scoring.

---

# 8. Lines and Odds

Contest spreads and Upset Special values are snapshots.

They do not change after the contest opens.

Store:

- displayed line/odds
- source
- capture timestamp

Example:

```text
Clemson -4.5

Captured Fri 6:02 PM
Source: [source]
```

This preserves the actual information participants used when making their selections.

Do not model contest scoring around continuously changing betting lines.

---

# 9. Global Lock

The contest uses a **single global lock time**.

Before lock:

- picks remain private
- picks may be freely edited
- participants may submit/re-submit
- the commissioner can see completion status
- the commissioner cannot see secret selections merely because they are commissioner

At lock:

- all selections freeze simultaneously
- normal editing ends
- Reveal begins

---

## 9.1 Submission

"Submitted" means:

> The participant has completed their card and considers it ready.

It does **not** mean selections become irrevocable before global lock.

A submitted participant may continue changing selections until lock.

If the card remains complete after an edit, the participant remains in Submitted status.

---

## 9.2 Pick revision history

Changes before lock should be retained.

This information is not exposed before lock but may later become material for commentary.

Examples:

```text
COLD FEET

Chris switched from LSU to Clemson
7 minutes before lock.
```

```text
TRUST YOUR GUT NEXT TIME

Chris originally had LSU.
He changed the pick at 10:53.
LSU won.
```

---

## 9.3 Commissioner-assisted picks

Before lock, the commissioner may enter or modify selections on behalf of a participant.

Such changes should be audited.

Example:

```text
Last edited by Commissioner
```

---

## 9.4 Post-lock changes

Normal editing is prohibited after global lock.

A future emergency correction mechanism may exist, but it must be:

- explicitly commissioner initiated
- exceptional
- auditable

It must not behave like a normal Edit button.

---

# 10. Incomplete Cards

An incomplete card remains valid.

At global lock:

> **Every completed selection becomes final and scores normally. Every unanswered or invalid selection earns 0 points.**

Failure to finish one part of the card does not invalidate completed selections.

Example:

If a participant completes everything except Upset Special:

- all completed selections score normally
- Upset Special = 0

For Confidence picks, only valid completed winner/confidence pairings are eligible to score.

---

# 11. Canceled, Postponed and Unresolvable Outcomes

The contest is intended to resolve **that day**.

A postponed game is therefore treated as unavailable for this contest even if it is eventually played later.

General rule:

> **If a game or proposition cannot be resolved that day, it is void and awards 0 points.**

This applies to:

- Confidence
- ATS
- Upset Special
- Main Event propositions

Exception:

### ATS push

A game that finishes exactly on the frozen spread has actually resolved.

An ATS push awards:

**1 point**

Unavailable tiebreak criteria are skipped rather than assigned an artificial result.

---

# 12. Champion and Tiebreaker

The contest recognizes one champion whenever possible.

Primary ranking:

**Total contest points**

If tied, use GT/Tennessee predicted final score.

Score error:

```text
|Predicted GT - Actual GT|
+
|Predicted Tennessee - Actual Tennessee|
```

Lowest combined error wins.

If participants remain tied after the available tiebreaker, they are **co-champions**.

Do not create an increasingly arbitrary chain of obscure tiebreakers merely to force one winner.

---

# 13. Contest Lifecycle

The primary experience moves through:

```text
PREGAME
   ↓
REVEAL
   ↓
LIVE
   ↓
MAIN EVENT
   ↓
FINAL
```

The default mode may change automatically according to contest state.

The commissioner may eventually have manual presentation override controls.

---

# 14. Pregame Mode

## Purpose

Get everyone's picks completed before global lock while making the administrative process entertaining.

---

## 14.1 Shared-screen experience

Primary elements:

### Persistent

- contest title / branding
- lock countdown
- overall completion status
- persistent QR code
- short contest code

### Rotating

- participant completion status
- commentary / trash talk
- today's contest slate
- upcoming games / kickoff times
- relevant contest information

Example:

```text
WEEK 2 TAILGATE PICK 'EM

PICKS LOCK IN
47:18

8 OF 11 PICKS IN

✓ Hudson      PICKS IN
✓ Sarah       PICKS IN
  Chris       11 / 15
  Zach         8 / 15   REMOTE
  Kevin        NOT STARTED
```

No selections are revealed.

---

## 14.2 Pregame commentary

Commentary should respond to participant behavior and escalate as lock approaches.

Examples:

```text
KEVIN HAS NOT STARTED

An interesting strategy with
38 minutes remaining.
```

```text
BREAKING NEWS

Chris has submitted his picks.

There was much rejoicing.
```

```text
SECOND THOUGHTS

Mike has changed his picks
7 times.

We haven't even kicked off.
```

The final minutes should increasingly focus on incomplete participants.

---

## 14.3 Participant phone

Primary participant functions:

- make picks
- review picks
- see completion
- see lock countdown
- see general participant completion status

Pick sections:

```text
Confidence
ATS
Upset Special
Main Event
```

Participants may complete sections in any order.

Selections autosave.

---

## 14.4 Commissioner phone

Additional functions:

- approve/deny participants
- assign On Site / Remote
- mark Not Playing
- view completion status
- assist with participant picks
- manage contest state
- control shared display when necessary

The commissioner should not receive privileged visibility into secret pre-lock picks.

---

# 15. Reveal Mode

## Purpose

Turn the locked selections into a shared entertainment moment.

The Reveal should be **paced and phased**, not an immediate spreadsheet dump.

---

## 15.1 Reveal embargo

At global lock:

- picks are frozen
- participants can still see their own card
- other participants' cards remain temporarily hidden

The full board does not become public until Reveal completes.

This prevents phones from spoiling the shared presentation.

---

## 15.2 On-site participants

The shared display provides the Reveal presentation.

On-site phones primarily display:

```text
PICKS LOCKED

Reveal in progress...
```

along with access to the participant's own card.

---

## 15.3 Remote participants

Remote participants receive the Reveal presentation through their browser.

The Reveal system therefore must not fundamentally depend on a television.

A future fully remote contest may present Reveal to every participant through their browser.

---

## 15.4 Reveal Director

Reveal content is generated from locked contest data.

The system first detects potentially interesting facts and then ranks/selects them for presentation.

Candidate Reveal Score dimensions:

```text
Rarity
+ Stakes
+ Conflict
+ Narrative
+ Recency
- Redundancy
```

Possible observations include:

- lone wolf
- two holdouts
- near-even split
- unanimous pick
- high-confidence contrarian pick
- large Upset Special
- Coward's Point usage
- late pick switch
- repeated pick changes
- Main Event disagreement

Related facts should be clustered into one story.

Example:

```text
ALL IN

11 of 12 picked Clemson.

Dave took LSU.
Confidence: 6.

He switched to LSU
3 minutes before lock.

This was a conscious decision.
```

---

## 15.5 Reveal variety

The Reveal Director should not simply sort observations by score.

It should construct a presentation arc with variety.

Potential structure:

```text
Warm-up
→ Consensus
→ Disagreement
→ Bigger disagreement
→ Upset Special
→ Main Event
→ Major revelation
→ Full Board
```

Exact duration, weights and sequencing algorithms are deferred.

---

# 16. Live Mode

## Purpose

Live Mode is a **secondary-screen experience**.

The main television displays football, potentially using YouTube TV Multiview with up to four simultaneous games.

The application runs primarily on:

- laptop
- secondary television
- participant phones

Core principle:

> **Live Mode does not tell us what is happening in the games. It tells us what those games mean for our contest.**

---

## 16.1 Core Live information

Live should emphasize:

- actual standings
- projected standings
- active contest games
- individual participant rooting interests
- confidence values
- ATS exposure
- Upset Special exposure
- leaderboard movement
- paths to meaningful swings
- contextual commentary
- upcoming contest games

Avoid duplicating generic broadcast information unless necessary for context.

---

## 16.2 Individual interests over aggregates

At the expected participant count, individual names are more useful than aggregate pick counts.

Prefer:

```text
CLEMSON

Sarah   6
Hudson  5
Mike    2

LSU

Dave    6
Chris   4
Zach    3
```

over only:

```text
Clemson: 3 picks / 13 confidence points
LSU:     3 picks / 13 confidence points
```

The application should answer:

> Who has this team?

and:

> How many points does that person have on it?

without requiring someone to open their phone.

---

## 16.3 Multiple propositions on one game

A Live game panel displays every contest proposition attached to that game.

Example:

```text
GEORGIA 17 — AUBURN 20
3Q 2:41

CONFIDENCE

Georgia               Auburn
Sarah 6               Hudson 4
Dave 3                Chris 2
Mike 1                Zach 5

ATS • Georgia -3.5

Georgia -3.5          Auburn +3.5
Sarah                 Hudson
Dave                  Chris
Mike                  Zach

UPSET SPECIAL

🔥 Zach — Auburn • 5 pts
```

Overlap may make a particular game especially consequential to the contest.

---

# 17. Live Curation

Worst case may include four simultaneous contest games, each with multiple scoring implications.

The interface must not attempt to give every game maximum detail simultaneously.

Core principle:

> **Breadth is guaranteed; depth is earned.**

Every active contest game remains visible.

The most consequential game receives the deepest treatment.

---

## 17.1 Information levels

### Featured game

May show:

- individual picks
- confidence values
- ATS selections
- Upset Special exposure
- leaderboard implications
- contextual commentary

### Secondary games

Show enough information to understand:

- score/status
- contest category
- general split/exposure
- especially notable participant stakes

### All games

At minimum remain visible with:

- teams
- score
- game state
- relevant contest indicators

No active contest game should disappear merely because another game is more interesting.

---

## 17.2 Contest Impact Score

The Live Director determines which game currently deserves emphasis.

Conceptual inputs:

```text
Closeness
× Urgency
× Disagreement
× Points at stake
× Leaderboard leverage
× Proposition overlap
```

Exact formula is deferred.

A close fourth-quarter game with:

- split confidence selections
- high confidence values
- split ATS selections
- a high-value Upset Special
- major leaderboard implications

should naturally become the featured game.

---

## 17.3 Hysteresis / display stickiness

The featured game should not constantly switch because two Impact Scores fluctuate slightly.

Once featured, a game receives some presentation stickiness.

Another game must become meaningfully more important before automatically replacing it.

The commissioner may manually feature a game at any time.

---

## 17.4 Phone drill-down

The shared secondary screen answers:

> What matters most right now?

Participant phones answer detailed questions.

A participant can tap any active game and inspect complete individual exposure even when that game is not currently featured.

---

# 18. Automatic Live Game Data

Automatic live scores/status are a **v1 goal**.

Manual score entry alone would create too much commissioner workload when several games are being watched simultaneously.

The external provider should feed an internal normalized Game State.

Conceptually:

```text
External Sports Provider
        ↓
Game Data Service
        ↓
Normalized Game State
        ↓
Contest Scoring Engine
      
