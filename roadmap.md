# Roadmap

## Offline reliability + PDF export (uploaded brief) — DONE
- [x] Inspected existing offline/PDF code (query cache persistence, setup/session PDFs existed)
- [x] Offline write queue `src/lib/offline-queue.ts` + sync hook `src/lib/offline-sync.tsx` (9 tests)
- [x] Race Mode laps, tyre pressures, feedback queue offline; auto-sync on reconnect; dedupe via client UUIDs + ignoreDuplicates upsert
- [x] Status chip shows Offline · N queued / Syncing
- [x] New PDFs: tyre records, weekend debrief, setup comparison (branded)
- [x] Validated: offline feedback → reconnect → synced → persists after refresh; exactly 1 DB row; PDFs render correctly
- [x] 120 tests pass, typecheck + build clean
- Not published — awaiting user go-ahead
