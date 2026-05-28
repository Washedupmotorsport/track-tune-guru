## Pit-Lane Optimization Plan

Focused, high-impact pass — no new features, just making the existing screens usable while standing next to the car in direct sun with gloves on.

### 1. Global controls — sunlight + glove friendly
- Buttons: bump default `h-9` → `h-11`, `sm` → `h-9`, `lg` → `h-12`; min width `min-w-11`; bolder font weight; stronger active/pressed state.
- Inputs / Select / Textarea: `h-9` → `h-11`, `text-sm` → `text-base`, thicker `border` (1.5px), focus ring `ring-2` red.
- Slider: thumb 3.5 → 5; track 1 → 2; add visible tick marks.
- Switch / Checkbox: enlarge ~30%.
- Contrast: lift `--foreground` and `--muted-foreground` luminance; darken `--background` slightly; raise border contrast for outdoor readability.
- Numerics everywhere: `tabular-nums` + telemetry-value class on key values (pressures, temps, lap times).

### 2. Tyre pressure quick-edit (highest priority pit task)
- On `tyre-setup` and `setup-console`, replace number inputs with **stepper controls**: big `−` / `+` buttons (h-12, w-12) flanking a large value display, configurable step (0.1 / 0.5 psi). One tap = one adjustment.
- Auto-save on change (debounced 400ms), no Save button needed.
- Per-corner color status (cold/optimal/hot) visible at a glance.

### 3. Suspension / setup adjust
- Same stepper pattern for camber, toe, ride height, spring rate, ARB, brake bias.
- Add a sticky bottom action bar on mobile setup screen: `[Save] [Duplicate] [Compare]` — h-12, full-width split, always reachable with thumb.

### 4. Driver feedback — 1-tap logging
- In `setup-console` feedback section: make complaint buttons full-width on mobile, h-14, large icon + label, toggle state with haptic-style press feedback.
- Add a floating "Quick Log" FAB on sessions/setup screens (mobile only) → opens a bottom-sheet with the 6 complaint chips + a voice-note button.

### 5. Sessions — fast logging
- Sessions list: bigger row height (h-16), large lap-time as primary, secondary meta muted.
- "New lap" / "End session" actions promoted to sticky bottom bar.

### 6. Setup compare — fewer taps
- On `/setups` list: add a checkbox per row + sticky "Compare (N)" bar → jumps straight to compare view. Removes the current nested flow.

### 7. Navigation — flatten
- App shell: convert mobile nav from hamburger/sheet to a **bottom tab bar** (5 primary: Sessions, Setups, Tyres, Garage, More) — thumb-reachable, always visible.
- Desktop layout unchanged.

### 8. Density tuning for mobile
- On screens <768px: reduce horizontal padding to `px-3`, but **increase vertical rhythm** on interactive rows to keep tap targets ≥44px.
- Hide non-essential secondary metadata behind a "Details" toggle on small viewports.

### Files to touch
- `src/components/ui/{button,input,select,textarea,slider,switch,checkbox}.tsx` — sizing
- `src/styles.css` — contrast tokens, stepper utility class
- `src/components/app-shell.tsx` — bottom tab bar on mobile
- `src/components/setup-console.tsx` — steppers + sticky action bar + feedback FAB
- `src/components/stepper.tsx` — NEW reusable big-touch stepper
- `src/routes/_authenticated/{setups,tyre-setup,tyre-wear,sessions,sessions.$sessionId}.tsx` — apply steppers, sticky bars, compare checkboxes

### Out of scope
- No new data models or backend changes
- No new pages
- Keep desktop layouts unchanged except where they naturally benefit (larger numbers, contrast)

Approve and I'll ship it in one pass.