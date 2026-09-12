# Demo contest

[Open the shared demo](https://djhbbw57tyj22.cloudfront.net/?contest=demo-168ece76-6764-4602-9958-14aac462e5e6&display=1).

Four fictional participants: Casey, Morgan, Riley and Jordan. The frozen slate is copied from the revised contest; players, picks and scores are independently created. The title identifies the data as fictional. The scene is paused in LIVE: four completed games, two simulated games in progress, and the Main Event awaiting kickoff. No provider polling targets this contest.

Casey has 11 banked points; Jordan has 6 banked but 17 projected. Casey's six-point Alabama pick is trailing Kentucky and triggers the commentary. Expanding a player shows the full card. Commissioner results entry on the participant view can advance simulated games. Do not change the real contest to demonstrate features.

`scripts/create-demo.py` uses isolated personal AWS credentials and creates a fresh demo ID each time; it is not a reset command. It uses commissioner API actions for setup and results, and changes only that new demo's deadline to enter Reveal. Setup participant sessions are removed afterward. The demo participants/cards/results are deliberately retained for viewing. This is a static demonstration scene, not an automatic replay or a prediction of actual results.
