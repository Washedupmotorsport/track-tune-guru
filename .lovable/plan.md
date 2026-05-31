## Race Weekend Usability Audit — pass 2

Goal: every screen survives 5 minutes between sessions, sun on the screen, gloves on hands, one thumb free. Verdict on each change driven by: **fewer taps · bigger targets · louder primary action · quieter secondary info.**

### A. Global quick wins (every screen inherits)

1. **Contrast lift in `src/styles.css`** — raise `--foreground` and `--muted-foreground` luminance, push `--border` from low-alpha to 1.5px solid token, brighten `--primary` for outdoor legibility. Both themes.
2. **`.telemetry-value` utility** — `font-mono tabular-nums tracking-tight text-[18px] md:text-[20px] font-semibold`. Apply to lap times, pressures, temps, deltas wherever they render.
3. **Tap-target floor** — audit `size="icon"` buttons and small `<button>`s app-wide; enforce `min-h-11 min-w-11`. Sticky bottom bars get `h-12`.
4. **Headers shrink on mobile** — sticky top header drops to 44px and hides the SI/US, currency, and theme controls behind the `All` menu on <768px. Reclaims ~80px of vertical space per screen.
5. **Terminology sweep (light, non-breaking)** — `Sympathy` → `Reliability`, `Confidence` → `Driver Confidence`, `Philosophies` → `Setup Notes` in nav labels only (routes unchanged). Tooltips on any abbreviation under 4 chars.
6. **Quick-Log FAB** — already exists; promote it to also appear on Cockpit, Pitwall, Sessions detail, Debrief. Add a 6th chip: "Flag issue → Critical".

### B. Top 5 hotspot rebuilds

**1. Engineer Cockpit (`/engineer`)**
- Engineering Priorities (just added) moves to the TOP of the screen, above the fold, sorted Critical → Testing → Monitor → Resolved.
- Each priority row: h-16, status chip on the left in solid color (red/amber/blue/green), title in `.telemetry-value`, one-tap status cycle button on the right (long-press = delete).
- Collapse the "What changed since last session" and "Recent notes" cards behind a single `Details` toggle on mobile.
- Sticky bottom action: `[+ Priority] [Open Pitwall]`.

**2. Pitwall (`/pitwall`)**
- Replace the current multi-card grid with a 3-zone stack: **Now** (current session + lap timer), **Next** (upcoming session, weather, tyre allocation left), **Watch** (top 3 active Critical/Testing priorities pulled from Cockpit).
- Lap timer becomes the hero: full-width, 56px digits, single big `[Lap]` button h-16 at the bottom.
- Move flags/incidents and track evolution into a `More` accordion.

**3. Tyre setup (`/tyre-setup`)**
- Already on corner-grid steppers per the plan file. Audit: confirm auto-save works without the Save button on mobile, confirm cold/optimal/hot color baked into each cell, confirm long-press for 0.1psi step.
- Add a sticky top chip row: `[Compound] [Heat cycles] [Set #]` — one tap each, no dropdowns.
- Hide the history table behind a `History` toggle on <768px.

**4. Setup console (`/setups/$setupId` via `setup-console.tsx`)**
- All numeric fields → steppers (camber, toe, ride height, spring rate, ARB, brake bias). h-12 cells.
- Driver-feedback chips: full-width, h-14, large icon + label, pressed state has a 2px ring.
- Sticky bottom split bar: `[Save] [Duplicate] [Compare]` h-12 — replaces scattered buttons.
- Tabs (suspension/aero/brakes/etc.) become a horizontal scroll strip on mobile, not a wrap.

**5. Sessions list + detail (`/sessions`, `/sessions/$sessionId`)**
- List rows: h-16, lap-time in `.telemetry-value` as primary, driver/track muted secondary.
- Detail screen: sticky bottom `[+ Lap] [End session]` h-12 full-width split.
- "Add lap" opens a number-pad sheet, not a keyboard input — minutes/seconds/millis steppers.

### C. Out of scope (this pass)

- No nav restructure — bottom tab bar stays at 7 slots per your call.
- No new theme — contrast lift goes into existing dark/light tokens.
- No DB schema changes.
- No renames of route paths, just nav-label copy.

### Files touched

```
src/styles.css                                — tokens + .telemetry-value
src/components/app-shell.tsx                  — slimmer mobile header
src/components/quick-log-fab.tsx              — visible on more screens, +1 chip
src/components/setup-console.tsx              — steppers, sticky bar, chip feedback
src/components/stepper.tsx                    — confirm long-press behavior
src/routes/_authenticated/engineer.tsx        — priorities to top, sticky bar
src/routes/_authenticated/pitwall.tsx         — Now / Next / Watch zones
src/routes/_authenticated/tyre-setup.tsx      — sticky chip row, history toggle
src/routes/_authenticated/sessions.tsx        — row sizing
src/routes/_authenticated/sessions.$sessionId.tsx — sticky bar, numpad lap input
```

### Verification

After shipping I'll open the preview at 390×844 (phone) and 864×608 (your current viewport), spot-check Cockpit, Pitwall, Tyres, and Sessions, and report what looks right vs needs another pass.

Approve and I'll ship it in one go.