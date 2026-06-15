# Launch Readiness Plan

This is a large, multi-area polish pass on an existing app. To keep it tractable and reviewable, I want to confirm scope and sequencing before editing ~20+ files. Nothing here rebuilds existing features — it connects, restyles, and adds glue.

## Phase 1 — Foundation (routing + shell)

**1.1 Make `/weekends` the post-login landing**
- `_authenticated/route.tsx` (managed gate) already redirects unauth → `/auth`. Add a redirect from `/` → `/weekends` only for authenticated users (keep public landing for signed-out visitors).
- Update `<Link to="/engineer">Open Cockpit</Link>` on `index.tsx` to point to `/weekends`.

**1.2 Active Weekend context**
- New `src/lib/active-weekend.tsx` provider: persists `activeEventId`, `activeCarId`, `activeSessionId`, `activeSetupId`, `activeTireSetId` to localStorage + syncs from URL when on `/weekends/$eventId`.
- Mount inside `_authenticated.tsx` so every authed page can read it.

**1.3 Shared `AppHeader` + `AppFooter`**
- Header (in `app-shell.tsx`): logo, active weekend name, active car, active track, sync/save indicator (driven by react-query `isFetching`), user menu (existing).
- Footer: version (from `package.json` via vite define), Support / Privacy / Terms links, "Last saved Xs ago" from a shared `useLastSaved()` store.
- Keep current 6-tab nav (Weekend / Sessions / Tyres / Setup / Pitwall / Debrief) — rename existing nav items to match exactly.

## Phase 2 — Weekend Command Centre

Rewrite `weekends.$eventId.tsx` (and `weekends.tsx` index) into a dense MoTeC-style dashboard with these cards:
- Active car · Active track · Current session · Fastest lap · Setup version · Tyre set · Weather
- Latest AI recommendation (read from `session_debriefs.ai_summary` most recent)
- Latest driver feedback (most recent `driver_feedback`)
- Latest debrief note
- `<WeekendTimeline />` (already exists — reuse, scoped to event's sessions)

All data fetched via existing supabase tables filtered by `event_id` / session IDs belonging to event.

## Phase 3 — Timeline auto-events

`WeekendTimeline` already derives events from existing tables (sessions, setup_changes, tire_logs, driver_feedback, debriefs, best lap). That covers all 7 requested triggers without new DB writes. Verify each insertion path (session create, setup change form, tyre log, feedback, debrief) writes to the correct table with `session_id` — patch any missing FKs.

No schema migration unless a gap is found.

## Phase 4 — Engineering Memory & AI Engineer

- **Memory**: surface "Relevant past notes" panel on the Weekend Hub by querying `engineering_memory` filtered by current `track_id` / `car_id`. No new tables — uses existing columns.
- **AI Engineer**: extend the existing `advisor.functions.ts` server function to accept `{ eventId }` and auto-load track, car, weather, latest tyre log, current setup, recent feedback. Add a "Data used" expandable block in the UI listing what context was injected.

## Phase 5 — Visual standardisation

Update `src/styles.css` tokens for a darker engineering-notebook palette and update shared primitives (`Card`, `CardHeader`, table styles) for tighter MoTeC density. Sweep major routes for spacing/heading consistency — no per-page redesigns.

## Phase 6 — Verify

Run typecheck/build (auto), fix routing/TS errors, smoke-test `/`, `/weekends`, `/weekends/$eventId`, `/sessions`, `/pitwall`.

---

## Scope confirmation before I start

This will touch ~25–35 files. A few decisions I'd like to confirm rather than guess:

1. **Landing redirect**: should signed-in users hitting `/` always bounce to `/weekends`, or keep the marketing landing reachable (e.g. via logo click)?
2. **"Active weekend"** when none selected: auto-pick most-recent event, or show a picker on `/weekends`?
3. **Visual overhaul depth**: light token tweaks + Card/Table density (safe, ~1 hr), or a deeper sweep of every route (higher risk of regressions on the routes you just dialled in like Pitwall/Pitlane)?
4. **Schema changes**: I'd prefer to avoid any migrations and only wire existing tables. OK?

If you want, I can also just proceed with sensible defaults (redirect always, auto-pick most recent, light visual sweep, no migrations) — say "go with defaults" and I'll execute the full plan end-to-end.