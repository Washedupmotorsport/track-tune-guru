# Roadmap

## Handling-issue engineering assistant (uploaded brief)
- [ ] Explore setup-library, session-debrief, session-compare, existing data shapes
- [ ] Pure analysis module `src/lib/handling-assistant.ts` + tests (issues, causes, recommended test, expected result, missing data; safety-critical flagging)
- [ ] Card component `src/components/handling-assistant.tsx` (HANDLING ISSUE / POSSIBLE CAUSES / RECOMMENDED TEST / EXPECTED RESULT / ACTUAL RESULT)
- [ ] Wire into Setup Library + Session Debrief (no new nav section)
- [ ] Save recommendation as proposed test; accept/reject/save; record actual adjustment separately; compare next session
- [ ] Verify with mid-corner understeer scenario in Playwright (mobile too)
- [ ] Run tests + build, commit
