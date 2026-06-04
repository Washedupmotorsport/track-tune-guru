# Tutorial system — A + B + C

A complete in-app learning system: a searchable manual, a first-run guided tour, and embedded video walkthroughs.

## A — In-app Manual (`/manual`)

New route under Cockpit with a sectioned, searchable handbook.

- **Layout:** left sidebar (sections), main content (markdown-style cards), top search bar (client-side filter over titles + body).
- **Sections (one per workspace):** Getting Started, Cockpit, Race Mode (Pitwall / Race Mode / Pit Lane / Track Evolution), Setup, Sessions (incl. Debrief), Tyres, Driver Hub, Engineering Log, Garage & Operations, Tools (Calculators), Keyboard Shortcuts, FAQ.
- **Per section:** what it's for, when to use it during a race weekend, key buttons, common pitfalls, "Open this screen" deep link, embed slot for a video.
- **Content source:** static TS data file `src/lib/manual-content.ts` — easy to edit, no backend needed.
- **`?` Help button in header:** opens the manual section relevant to the current route (path → section map).
- **Nav entry:** added to `app-shell.tsx` All-routes menu under a new "Help" group, plus a small "First-time here? Read the manual" callout on `/engineer` (Cockpit) that dismisses to localStorage.

## B — Guided Tour overlay

Coachmark step-through for first-run onboarding on each workspace.

- **Library:** lightweight custom overlay (no extra dependency) — fixed-position spotlight + tooltip card, driven by an array of `{ selector, title, body, route }` steps.
- **Trigger:** auto-runs once per workspace on first visit (tracked in `tutorial_progress` table, scoped to `user_id` + `tour_key`). Manually re-runnable from manual page or `?` menu ("Replay tour").
- **Tours shipped:** `cockpit`, `race-mode`, `sessions`, `setup`, `tyres`, `driver`, `garage` — 4–6 steps each.
- **Backend:** new `tutorial_progress` table — `user_id`, `tour_key`, `completed_at`. RLS scoped to `auth.uid()`. GRANTs to authenticated + service_role.

## C — Video walkthroughs (C1 embedded + C2 generated intros)

- **C1 — Embeds:** each manual section has an optional `videoUrl` field. Renders a `<video>` (or YouTube/Vimeo iframe if URL is a known host). You/the user uploads MP4 to Lovable Cloud Storage `tutorials` bucket (public read) or pastes a YouTube/Vimeo link. Empty by default — placeholders show "Video coming soon".
- **C2 — AI-generated workspace intros (optional, ship 1 as proof):** generate a 5–10 s motion-graphics clip for the Cockpit section using the video skill, store under `public/tutorials/cockpit-intro.mp4`. User can request more later.

## Technical details

**Files added**
- `src/routes/_authenticated/manual.tsx` — manual page with sidebar + search + section renderer.
- `src/lib/manual-content.ts` — section data (id, title, route, body markdown-ish, bullets, videoUrl?).
- `src/lib/route-to-manual.ts` — map current pathname → manual section id (for context `?` button).
- `src/components/help-button.tsx` — `?` icon button in header; navigates to `/manual?section=<id>`.
- `src/components/guided-tour.tsx` — overlay component; reads tour from `src/lib/tours.ts`, persists completion via server fn.
- `src/lib/tours.ts` — tour definitions keyed by workspace.
- `src/lib/tutorial-progress.functions.ts` — `getCompletedTours` + `markTourComplete` server functions (uses `requireSupabaseAuth`).
- `src/components/first-time-callout.tsx` — Cockpit banner.

**Files edited**
- `src/components/app-shell.tsx` — add Help button next to theme toggle; add "Help" group to All-routes menu with Manual + Replay tour.
- `src/routes/_authenticated/engineer.tsx` — mount `<FirstTimeCallout />` at top.
- Workspace front-door routes — mount `<GuidedTour tourKey="..." />` (no UI until triggered).

**Bucket**
- Create `tutorials` storage bucket (public read) for user-uploaded clips.

**Migration**
- `tutorial_progress` table + RLS + GRANTs.

## Build order

1. Migration: `tutorial_progress` + storage bucket.
2. Manual content + route + sidebar/search/section UI.
3. Header `?` button + route→section mapping.
4. Tutorial progress server fns + guided tour overlay + tours data.
5. Mount tours on workspace front doors + first-time callout on Cockpit.
6. Generate 1 sample intro video for Cockpit (proof of C2).

## Out of scope (for now)

- Per-user manual bookmarks / progress tracking.
- Multi-language manual.
- Recording user-narrated walkthroughs (you supply MP4s when ready).