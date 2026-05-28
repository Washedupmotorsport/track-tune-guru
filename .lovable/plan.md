## Race-weekend mode: pit-lane optimization pass

A focused refactor across the high-traffic screens so they survive sun, gloves, and 5 minutes between sessions. No new features — just radically faster paths to the actions an engineer actually performs in the pit lane.

### Principles applied everywhere
- **Thumb-zone first**: primary actions sit in a sticky bottom bar on mobile, never behind a menu.
- **Steppers over keyboards**: numeric edits use big −/+ buttons (h-12) with auto-save. No "Save" button to hunt for.
- **Big type, tabular numerics**: pressures/temps/lap times in mono tabular figures at ≥18px.
- **Sunlight contrast**: lift foreground luminance, thicker borders (1.5px), ring-2 focus.
- **1 tap = 1 decision**: collapse multi-step flows (compare, log lap, log complaint) into single sticky actions.

### 1. Global controls
- Buttons default `h-11`, lg `h-12`, sm `h-9`; bolder font, stronger pressed state. *(already done — keep)*
- Inputs/Select/Textarea → `h-11`, `text-base`, border 1.5px, `ring-2` red focus.
- Slider thumb 5, track 2, visible ticks.
- Switch/Checkbox +30% size.
- Token tweak in `src/styles.css`: lift `--foreground` / `--muted-foreground`, raise `--border` contrast, add `.telemetry-value` utility (`font-mono tabular-nums tracking-tight`).

### 2. Mobile shell → bottom tab bar
`src/components/app-shell.tsx`: on <768px replace the hamburger/sheet with a 5-slot bottom tab bar — **Sessions · Setups · Tyres · Garage · More**. Always visible, thumb-reachable, 56px tall, safe-area padding. Desktop layout unchanged.

### 3. Tyre logging — the #1 pit task
`src/routes/_authenticated/tyre-setup.tsx` + `tyre-wear.tsx` + `tires.tsx` "New log" dialog:
- Replace 4 number inputs per row with a **2×2 corner grid of steppers** (FL/FR/RL/RR), each cell h-20: large value, −/+ on either side, step 0.5 psi (long-press for 0.1).
- Per-corner color status (cold/optimal/hot) baked into the cell.
- Auto-save on change (400ms debounce). No Save button on mobile.
- Compound + heat cycles promoted to chip selectors at the top.

### 4. Setup console — fast tweaks
`src/components/setup-console.tsx`:
- Camber, toe, ride height, spring rate, ARB, brake bias all switch to the stepper pattern.
- Sticky bottom action bar on mobile: `[Save] [Duplicate] [Compare]` — h-12, full-width split.
- Driver-feedback complaint chips: full-width, h-14, large icon + label, toggle with visible pressed state.

### 5. Quick-Log FAB (mobile only)
Floating action button on Sessions / Setup / Tyres screens → bottom sheet with: 6 complaint chips, voice note button, quick lap-time entry. One tap to open, one tap to log.

### 6. Sessions
`src/routes/_authenticated/sessions.tsx` + `sessions.$sessionId.tsx`:
- Row height h-16, lap-time as primary mono numeral, secondary meta muted.
- Sticky bottom bar with `[+ Lap] [End session]`.

### 7. Setups compare — fewer taps
`src/routes/_authenticated/setups.$setupId.tsx` list view:
- Checkbox per row → sticky "Compare (N)" bar at bottom → jump straight to compare. Removes the current nested flow.

### 8. Mobile density
- `px-3` horizontal, but row vertical ≥44px tap target.
- Hide secondary metadata behind "Details" toggle on <768px.

### Files to touch
```
src/components/ui/{input,select,textarea,slider,switch,checkbox}.tsx   — sizing
src/styles.css                                                          — contrast + .telemetry-value
src/components/app-shell.tsx                                            — bottom tab bar (mobile)
src/components/stepper.tsx                                              — extend: long-press, cell variant
src/components/setup-console.tsx                                        — steppers + sticky bar + chip feedback
src/components/quick-log-fab.tsx                                        — NEW
src/components/tyre-corner-grid.tsx                                     — NEW (2×2 stepper grid)
src/routes/_authenticated/tyre-setup.tsx                                — corner grid + auto-save
src/routes/_authenticated/tyre-wear.tsx                                 — corner grid
src/routes/_authenticated/tires.tsx                                     — corner grid in dialog
src/routes/_authenticated/sessions.tsx                                  — row sizing + sticky bar
src/routes/_authenticated/sessions.$sessionId.tsx                       — sticky [+ Lap] [End]
src/routes/_authenticated/setups.$setupId.tsx                           — compare checkboxes
```

### Out of scope
- No schema changes, no new tables.
- No new pages or routes.
- Desktop layouts unchanged except where they naturally inherit (bigger numbers, better contrast).

Approve and I'll ship it in one pass.
