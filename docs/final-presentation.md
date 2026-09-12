# Final presentation

Final mode now uses the section 7 mockup hierarchy on shared and participant surfaces: champion/co-champions, final points standings, then unofficial awards. Championship IDs and scoring come from the saved server board. Point ranks remain tied even when the score-prediction tiebreak chooses a champion; the UI explains this distinction. Participant detail cards remain expandable.

Awards are presentation-only, derived from final grades: Upset Prophet for the highest winning real upset award (excluding NO_UPSET), Confidence Without Competence for the greatest confidence value on losing picks (excluding voids), and Cellar Dweller for the lowest points when scores differ. Ties share awards; zero qualifying values omit the award. These metrics are explicit implementation choices, not additional formal winners.

Verification: 74 existing tests and frontend build pass. Rendering checks cover champion, co-champions, empty standings and void exclusions; a fictional final fixture was visually reviewed. No dependencies, scoring changes or cloud data changes. Deployment is pending.

The preceding user-operated Main Event rehearsal passed phone transitions, automatic pick updates, recovery, revoked older sessions, NO_PATH to ALIVE following fictional corrections, and automatic final standings. The separate rehearsal remains finalized with Hud as champion; the real contest was untouched.
