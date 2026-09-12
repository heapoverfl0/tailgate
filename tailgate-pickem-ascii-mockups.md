# Tailgate Pick'em --- ASCII UI Mockups

These are the latest consolidated ASCII mockups and
information-hierarchy examples for the Tailgate Pick'em experience. They
are design guidance rather than pixel-level UI specifications.

## 1. Participant Phone --- Pregame

``` text
┌──────────────────────────────┐
│ WEEK 2 PICK 'EM              │
│ Locks in 1:11:58             │
├──────────────────────────────┤
│                              │
│ YOUR PICKS                   │
│                              │
│ Confidence       0 / 6    →  │
│ Against Spread   0 / 3    →  │
│ Upset Special    —        →  │
│ Main Event       0 / 5    →  │
│                              │
│ 0 / 15 selections complete  │
│                              │
├──────────────────────────────┤
│ PICKS ARE PRIVATE UNTIL LOCK │
└──────────────────────────────┘
```

Once partially completed:

``` text
┌──────────────────────────────┐
│ WEEK 2 PICK 'EM              │
│ Locks in 0:42:17             │
├──────────────────────────────┤
│ YOUR PICKS                   │
│                              │
│ Confidence       6 / 6    ✓  │
│ Against Spread   2 / 3    →  │
│ Upset Special    LSU      ✓  │
│ Main Event       3 / 5    →  │
│                              │
│ 12 / 15 selections complete │
│                              │
│ Last saved 2:14 PM           │
└──────────────────────────────┘
```

Important behavior: **autosave + editable until global lock**. "Submit"
indicates completeness, not an irreversible submission.

## 2. Shared Display --- Pregame

``` text
┌───────────────────────────────────────────────────────────────┐
│  🐝 TAILGATE PICK 'EM                         LOCKS  1:11:58 │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│                     8 OF 11 PICKS IN                          │
│                                                               │
│  ✓ Hudson       ✓ Sarah        ✓ Mike        ○ Dave          │
│  ✓ Zach REMOTE  ✓ Chris        ○ Alex        ○ Jen           │
│                                                               │
├───────────────────────────────────────────────────────────────┤
│  TODAY'S SLATE                                                │
│                                                               │
│  11:00  Clemson vs LSU                 CONFIDENCE             │
│  11:00  Auburn -3.5 vs Florida         ATS                    │
│  2:30   Texas vs Oklahoma              CONFIDENCE             │
│  2:30   Wisconsin +7.5 vs Michigan     ATS                    │
│  ...                                                          │
│                                                               │
├───────────────────────────────────────┬───────────────────────┤
│  “Dave appears to be waiting for     │                       │
│   divine intervention.”              │       [ QR CODE ]     │
│                                      │                       │
│                                      │     JOIN: ABC123      │
└───────────────────────────────────────┴───────────────────────┘
```

The bottom commentary/slate content can rotate, while **title +
countdown + completion + QR** remain persistent.

Near lock:

``` text
┌───────────────────────────────────────────────────────────────┐
│                         0:00:43                               │
│                                                               │
│                      PICKS LOCK SOON                          │
│                                                               │
│                 DAVE STILL ISN'T DONE                         │
│                                                               │
│                    10 OF 11 COMPLETE                          │
└───────────────────────────────────────────────────────────────┘
```

At lock:

``` text
┌───────────────────────────────────────────────────────────────┐
│                                                               │
│                         PICKS LOCKED                          │
│                                                               │
│              LET'S SEE WHAT THESE IDIOTS DID                 │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

## 3. Reveal

### Lone Wolf

``` text
┌───────────────────────────────────────────────────────────────┐
│                        LONE WOLF                              │
│                                                               │
│                         MIKE                                  │
│                                                               │
│                    picked AUBURN                              │
│                                                               │
│             Everyone else picked Florida.                    │
│                                                               │
│      Either a visionary or an idiot. We'll find out.         │
└───────────────────────────────────────────────────────────────┘
```

### Confidence Reveal

``` text
┌───────────────────────────────────────────────────────────────┐
│                    THEY REALLY BELIEVE                        │
│                                                               │
│  HUDSON          Clemson                         6             │
│  DAVE            LSU                             6             │
│  SARAH           Georgia                         6             │
│  ZACH            Texas                           6             │
│                                                               │
│              No pressure, gentlemen.                          │
└───────────────────────────────────────────────────────────────┘
```

### Upset Special

``` text
┌───────────────────────────────────────────────────────────────┐
│                     UPSET SPECIAL                             │
│                                                               │
│  Hudson     Florida          +240          3 PTS              │
│  Sarah      Wisconsin        +475          5 PTS              │
│  Dave       LSU              +240          3 PTS              │
│  Zach       NO UPSET                         1 PT              │
│                                                               │
│                    ─────────────                              │
│                                                               │
│                  COWARD'S POINT                              │
│                       ZACH                                   │
└───────────────────────────────────────────────────────────────┘
```

### Reveal Complete

``` text
┌───────────────────────────────────────────────────────────────┐
│                                                               │
│                  THE PICKS ARE PUBLIC                         │
│                                                               │
│                 Let the excuses begin.                        │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

## 4. Shared Display --- Live Mode

The actual football broadcast owns the main TV. This is intended for the
secondary display, laptop, or smaller TV.

``` text
┌───────────────────────────────────────────────────────────────┐
│ TAILGATE PICK 'EM                           3 GAMES LIVE      │
├─────────────────────────────────────┬─────────────────────────┤
│ STANDINGS                           │ 🔥 GAME TO WATCH       │
│                                     │                         │
│             PTS   PROJ              │ CLEMSON  17             │
│ 1 Sarah      12    27   ↑2          │ LSU      21             │
│ 2 Hudson     11    25    —          │                         │
│ 3 Zach       10    24   ↑3 REMOTE   │ Q3  6:42                │
│ 4 Dave       10    19   ↓3          │                         │
│ 5 Mike        8    17   ↓1          │ HUDSON                  │
│                                     │ Clemson       CONF 6    │
│                                     │ Clemson -3.5  ATS       │
│                                     │                         │
│                                     │ DAVE                    │
│                                     │ LSU           CONF 5    │
│                                     │ LSU +3.5      ATS       │
│                                     │ LSU           UPSET 3   │
├─────────────────────────────────────┴─────────────────────────┤
│ LIVE                                                         │
│                                                               │
│ Auburn 24   Florida 20       Q4  8:11       CONF / ATS        │
│ Texas  14   Oklahoma 14      HALF           CONF              │
│                                                               │
├───────────────────────────────────────────────────────────────┤
│ BIGGEST SWING                                                 │
│                                                               │
│ If LSU holds on: Dave +10 projected points                    │
│                  Hudson loses 8 projected points              │
│                                                               │
│ “Dave putting six points on LSU is looking considerably      │
│  less stupid than it did two hours ago.”                      │
└───────────────────────────────────────────────────────────────┘
```

### Latest-observed game clock

``` text
Provider polls:

12:43  → display 12:43
11:58  → display 11:58
11:58  → no change
11:58  → no change
10:51  → display 10:51
```

The browser does not locally simulate clock movement between provider
observations.

## 5. Live Mode --- Game Exposure

``` text
┌─────────────────────────────────────────────┐
│ CLEMSON 17     LSU 21                       │
│ Q3  6:42                                    │
│                                             │
│ CONFIDENCE                                  │
│ Hudson    CLEMSON     6                     │
│ Sarah     CLEMSON     2                     │
│ Dave      LSU         5                     │
│ Zach      LSU         3                     │
│                                             │
│ AGAINST THE SPREAD                          │
│ Hudson    CLEMSON -3.5                      │
│ Sarah     LSU +3.5                          │
│ Dave      LSU +3.5                          │
│ Zach      CLEMSON -3.5                      │
│                                             │
│ UPSET SPECIAL                               │
│ Dave      LSU              3 PTS            │
│                                             │
│ ──────────────────────────────────────────  │
│ IF CURRENT RESULT HOLDS                     │
│ Dave     +10 projected                      │
│ Hudson    +0 from this game                 │
└─────────────────────────────────────────────┘
```

> **Each live game panel shows picks relevant to every contest
> proposition attached to that game.**

## 6. Participant Phone --- Main Event

``` text
┌──────────────────────────────┐
│ GT vs TENNESSEE             │
│ MAIN EVENT                  │
├──────────────────────────────┤
│ YOUR PICKS                  │
│                              │
│ ✓ First to score     GT      │
│ ✓ First score        TD      │
│ ✓ Halftime leader    TENN    │
│ ○ Winner             GT      │
│ ○ Total              OVER    │
│                              │
│ 2 / 5 DECIDED                │
├──────────────────────────────┤
│ DAY STANDINGS                │
│                              │
│ 1 Sarah        29             │
│ 2 Hudson       27   ← YOU     │
│ 3 Dave         26             │
│ 4 Zach         24             │
├──────────────────────────────┤
│ HOW YOU WIN                  │
│                              │
│ You need:                    │
│                              │
│ ✓ Georgia Tech to win        │
│ ✓ OVER 51.5                  │
│                              │
│ Sarah needs at least one     │
│ of those to miss.            │
└──────────────────────────────┘
```

### Eliminated State

``` text
┌──────────────────────────────┐
│                              │
│         ELIMINATED           │
│                              │
│ There is no remaining        │
│ combination of outcomes      │
│ where you finish first.      │
│                              │
│ It was a good run.           │
│ It wasn't, but that's what   │
│ people say.                  │
│                              │
└──────────────────────────────┘
```

## 7. Final Shared Display

``` text
┌───────────────────────────────────────────────────────────────┐
│                                                               │
│                    🏆 TAILGATE CHAMPION                       │
│                                                               │
│                          SARAH                                │
│                                                               │
│                        34 POINTS                              │
│                                                               │
├───────────────────────────────────────────────────────────────┤
│ FINAL STANDINGS                                               │
│                                                               │
│  1  Sarah        34                                           │
│  2  Hudson       32                                           │
│  3  Dave         29                                           │
│  4  Zach         27   REMOTE                                  │
│  5  Mike         22                                           │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│ UPSET PROPHET          Sarah                                  │
│ CELLAR DWELLER         Mike                                   │
│ CONFIDENCE WITHOUT                                            │
│ COMPETENCE             Dave                                   │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

## Implementation Note

These mockups define the latest agreed **information hierarchy, content,
and behavioral direction**. They are not intended to constrain the React
implementation to literal terminal-style boxes. The final UI should
preserve these priorities while using appropriate responsive visual
design for phone and shared-display surfaces.
