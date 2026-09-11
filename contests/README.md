# September 12, 2026 contest

## Revised contest — use this link

[Open the revised contest](https://djhbbw57tyj22.cloudfront.net/?contest=sept12-2026-revised). Created and verified with zero participants and picks, following the user's authorization to start over. The original contest remains intact; enrollment must be requested again on this replacement.

`sept12-2026-revised.json` replaces UCF–Pittsburgh with Alabama–Kentucky (3:30 p.m. Eastern), and Memphis–Boise State with App State–ECU (noon Eastern). All other games and the noon Eastern lock remain unchanged. Afternoon games may run into GT's kickoff; evening kickoffs outside the Main Event are excluded by user request.

ATS uses Oklahoma -5.5, Alabama -10 and ECU -6.5. The replacement lines were supplied by the commissioner, not fetched as new live quotes. Upset Special retains Michigan, Arizona State and Oklahoma State plus No Upset; the removed games' candidates and odds are removed, with no invented replacement moneylines.

Kickoff sources: [Kentucky game information](https://ukathletics.com/2026-football-media-center/) and [App State schedule](https://appstatesports.com/sports/football/schedule). Configuration validation passed; the creation response and public read verified seven games, fifteen slots, the lock timestamp and empty enrollment.

## Original contest (superseded)

[Open the contest](https://djhbbw57tyj22.cloudfront.net/?contest=sept12-2026). Code: `sept12-2026`.

The user selected Saturday September 12 and explicitly set the lock to **12:00 p.m. Eastern**: `2026-09-12T16:00:00.000Z`, timezone `America/New_York`. Saves at or after this deadline are rejected by the API. No participants or picks were seeded.

## Slate

Six Confidence games (all times Eastern):

| Away | Home | Kickoff |
| --- | --- | --- |
| Oklahoma | Michigan | Noon |
| Arizona State | Texas A&M | Noon |
| Oregon | Oklahoma State | Noon |
| UCF | Pittsburgh | 3:30 p.m. |
| Mississippi State | Minnesota | 3:30 p.m. |
| Memphis | Boise State | 6 p.m. |

Main Event: Tennessee at Georgia Tech, 7 p.m. Its five picks are winner, first team to score, first scoring play, halftime leader, and total over/under 55.5. The Main Event is excluded from Confidence, ATS and Upset Special. Score predictions supply the tiebreaker.

Schedule source: [NCAA September schedule](https://www.ncaa.com/news/football/article/2026-08-24/college-football-schedule-when-does-2026-college-football-season-start). Main Event confirmed against [Georgia Tech kickoff announcement](https://ramblinwreck.com/news/2026/05/27/september-kickoff-times-set-for-tech-football-2026).

## Frozen lines

ATS: Oklahoma -5.5 / Michigan +5.5; Pittsburgh -7 / UCF +7; Boise State -9 / Memphis +9.

Upset Special: Michigan +180 (2 points), Arizona State +500 (5), Oklahoma State +1150 (6), UCF +220 (3), Memphis +275 (3), plus No Upset (1 guaranteed point). Decimal prices 2.80, 6.00, 12.50, 3.20 and 3.75 were converted to positive American moneylines; points follow the design tiers.

ATS and moneyline source: [BetMGM football betting page](https://www.betmgm.com/en/sports/football-11/betting), public search-index snapshot reviewed September 11, 2026. Main Event total source: [CBS Week 2 odds](https://www.cbssports.com/college-football/odds/top25/2026/regular/week-2/), also a public search-index snapshot. These are fixed contest lines, not live API quotes. The JSON records source provenance and snapshot timestamp. Later book changes do not change this contest.

## Creation and verification

`sept12-2026.json` is the reviewed API payload. After building the API, `python3 scripts/seed-contest.py contests/sept12-2026.json` uses isolated personal AWS authentication to discover the deployment and creates the contest through the commissioner API. It reads the ignored local password file without printing it, refuses an existing contest, and verifies the public response. Do not rerun to update a contest; an uncertain creation response requires inspecting the existing contest first.

Creation returned HTTP 201; the public read confirmed seven games, fifteen slots, the exact lock timestamp and no participants/cards. The browser showed the correct contest title, join form and zero players.

Readable canonical team names currently serve as team IDs because the UI has no separate team-name catalog. Kickoff times appear in pick labels; the model has no dedicated kickoff field yet. This is the pregame experience: Reveal, Live scoring, game data integration and poller scheduling are not implemented. No game results have been invented or loaded.
