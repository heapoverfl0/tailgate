# Reveal presentation

Deployed the six-step Reveal presentation: prominent titles, progress markers, grouped choices and player names, confidence values when returned by the server, commentary and commissioner pacing. The component consumes only the existing filtered Reveal DTO. Shared displays have no advance control; authenticated commissioners use the participant page. Full cards remain withheld until the final step.

74 tests and TypeScript/Vite builds pass. All six steps rendered from fictional domain data; the Lone Wolves layout was visually checked. Published assets match the build. No server or privacy rule changes.

Separate demo: https://djhbbw57tyj22.cloudfront.net/?contest=demo-480227e5-8384-4e97-90bc-ac657175ce56&display=1 . Four fictional players, paused at step 0. Use its participant page and commissioner login to advance. Creation removed synthetic participant sessions, leaving picks for the demo. The real contest is untouched.
