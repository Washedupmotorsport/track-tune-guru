# Roadmap

## Current requests
- [x] Track Evolution temperature snapshots use the offline queue with selected session context and capture timestamps. Phone-sized offline → reconnect → second browser → reload verified with 26.5°C/34.5°C; exactly one saved row, test rows removed. 15 regression tests pass. Not published.
- [x] Trace Session Detail → Tyres; added session-bound shortcut using existing TyreGarage form, plus missing Sessions outlet required to reach details.
- [x] Validated at 390×844 with temporary VL Commodore Practice 2/Practice 1 records: correct hot corners, cold preservation, unchanged control, failed-save retry and missing-session guard; temporary records removed. Two regression tests pass; preview build OK.
- [x] Calendar and hot-pressure shortcut publishing requested for myraceengineer.app; security review has no critical findings. Deployment completion not verified.

## Audit fixes
- [x] Offline: cancellable queued laps, retry transient failures, reject permanent failures, account isolation and capture timestamps
- [x] Correct assistant car/session inputs, stale analysis and saved recommendation filtering
- [x] Correct circuit-specific historical setup rankings
- [x] Atomic tyre fitting/rotation and current-car quick pressure selection
- [x] Debrief and tyre PDF record context
- [x] Remove unsupported tyre pressure predictions and fix Setup Library phone overflow
- [x] Regression tests, signed-in browser checks, code-quality checks and fresh security review
- Verified: 125 passing tests, one pre-existing skip; real offline feedback sync survives refresh (test row cleaned); Undo, retry, assistant setup/session queries, PDF query and mobile overflow checked.
- Changed files have no lint errors; full-project lint retains pre-existing formatting/type/legacy redirect errors outside this fix scope. Security scan retains informational shared track-catalog read policy. Not published.

## Offline reliability + PDF export (uploaded brief) — DONE
- [x] Inspected existing offline/PDF code (query cache persistence, setup/session PDFs existed)
- [x] Offline write queue `src/lib/offline-queue.ts` + sync hook `src/lib/offline-sync.tsx` (9 tests)
- [x] Race Mode laps, tyre pressures, feedback queue offline; auto-sync on reconnect; dedupe via client UUIDs + ignoreDuplicates upsert
- [x] Status chip shows Offline · N queued / Syncing
- [x] New PDFs: tyre records, weekend debrief, setup comparison (branded)
- [x] Validated: offline feedback → reconnect → synced → persists after refresh; exactly 1 DB row; PDFs render correctly
- [x] 120 tests pass, typecheck + build clean
- Not published — awaiting user go-ahead
