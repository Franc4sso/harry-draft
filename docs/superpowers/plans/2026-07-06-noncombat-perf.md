# Non-combat page performance — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make the non-combat screens (menu, map, collection, shop, etc.) smooth by removing the always-on animated-background tax and per-screen redundant blur/ember effects — keeping the look as close to current as possible (static instead of animated).

**Architecture:** GameShell (mounted on every route) currently runs 3 huge animated blur blobs + 14 infinite embers + a blend-mode noise layer — a permanent compositor tax. Make it STATIC (blobs kept as static ambient glow at reduced blur radius, embers + noise removed). Then remove per-screen blobs that were stacked on top of the shell (Menu/Result/Boss), fix Collection's unsized/eager images (lazy + intrinsic size), and drop MapScreen's duplicate embers + swap its `filter`-based pulse for a transform/opacity one. Pure UI/CSS/markup — no engine changes.

**Tech Stack:** Next.js, React, framer-motion, Tailwind, CSS. Vitest for the DOM assertions.

## Global Constraints

- **Look as close to current as possible** — this is cost removal, not a redesign. Keep the warm "Sala Comune" gradient/glow; remove only MOVEMENT that isn't perceivable as information at that blur radius.
- Engine/game logic untouched — UI/CSS/markup only.
- `npm run test` does NOT run typecheck → run `npx tsc --noEmit` per task; build must pass.
- Existing screen tests stay green EXCEPT `tests/ui/gameShell.test.tsx` which asserts the old animated markup (`[data-ember]` > 8) — Task 1 updates it as an intended consequence of the static-background decision.
- `prefers-reduced-motion` gating that already exists must not regress (static background is inherently reduced-motion-friendly).
- Before removing any element, grep tests for a dependency on it.

---

### Task 1: GameShell → static background (remove the global tax)

**Files:**
- Modify: `components/ui/GameShell.tsx`
- Modify: `app/globals.css` (remove now-orphaned `@keyframes warmDrift`, `@keyframes emberRise` IF unreferenced elsewhere)
- Test: `tests/ui/gameShell.test.tsx`

**Interfaces:**
- Produces: `GameShell` renders a static ambient layer — same `aria-hidden`/`pointer-events-none`/`fixed` root, keeps the fog blobs as STATIC `data-fog` divs (no `animation`, reduced `blur`), NO embers, NO mix-blend noise.

- [ ] **Step 1: Update the test to the new static contract**

Rewrite `tests/ui/gameShell.test.tsx`'s second test. Keep the first test (aria-hidden/pointer-events/fixed) unchanged. Replace the ember/fog test:

```tsx
it('renders a static ambient layer with fog blobs and no infinite animations', () => {
  const { container } = render(<GameShell />)
  // Fog blobs remain (static ambient glow).
  expect(container.querySelectorAll('[data-fog]').length).toBeGreaterThanOrEqual(2)
  // No embers (removed for perf — static background).
  expect(container.querySelectorAll('[data-ember]').length).toBe(0)
  // No element carries an infinite CSS animation.
  const animated = Array.from(container.querySelectorAll<HTMLElement>('*'))
    .filter(el => (el.getAttribute('style') ?? '').includes('animation'))
  expect(animated.length).toBe(0)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/gameShell.test.tsx`
Expected: FAIL (current GameShell still has 14 embers + `animation:` inline styles).

- [ ] **Step 3: Make GameShell static**

Rewrite `components/ui/GameShell.tsx` to:
- Keep the root `<div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">`.
- Keep the 3 fog blobs as `data-fog` divs but: REMOVE the `animation` / `animationDelay` inline style props, and reduce `blur-[110px]/[120px]/[100px]` → `blur-[60px]` (a large-radius blur is the expensive part; 60px keeps the soft glow at far lower cost). Keep the same `background` radial gradients + positions/sizes. Drop the `anim-ambient` class from them (it only existed to gate the animation).
- REMOVE the entire `EMBER_COUNT`/`emberStyle`/embers `Array.from(...)` block and the `NOISE_URI` mix-blend noise div.
- Keep the vignette div unchanged (static already).
- Remove the now-unused `emberStyle` function and `EMBER_COUNT`/`NOISE_URI` consts.

Resulting file has no framer-motion, no `animation:`, no embers, no noise — just static blobs + vignette.

- [ ] **Step 4: Remove orphaned keyframes**

Grep first: `grep -rn "warmDrift\|emberRise" components/ app/ --include="*.tsx" --include="*.css"`. If `warmDrift` and `emberRise` are now referenced ONLY in their `@keyframes` definitions (no users), delete those `@keyframes` blocks from `app/globals.css`. If MapScreen or anything still uses `emberRise`, leave it (MapScreen uses `mapEmberRise`, a different name — verify). Leave `anim-ambient` CSS if other code uses it; grep to confirm.

- [ ] **Step 5: Verify**

Run: `npx vitest run tests/ui/gameShell.test.tsx` — Expected: PASS.
Run: `npx vitest run tests/ui tests/screens` — Expected: all green (no other test depended on shell embers).
Run: `npx tsc --noEmit` — clean.

- [ ] **Step 6: Commit**

```bash
git add components/ui/GameShell.tsx app/globals.css tests/ui/gameShell.test.tsx
git commit -m "perf(ui): GameShell static background — drop animated blobs/embers/noise, cut blur radius"
```

---

### Task 2: Remove per-screen redundant blur blobs (Menu / Result / Boss)

**Files:**
- Modify: `components/screens/MenuScreen.tsx`
- Modify: `components/screens/ResultScreen.tsx`
- Modify: `components/screens/BossScreen.tsx`
- Test: existing `tests/screens/` / `tests/ui/` stay green.

**Interfaces:**
- Consumes: GameShell now provides the static ambient background (Task 1) — screens must NOT add their own blur blobs.
- Produces: Menu/Result/Boss render without local `blur-[120-130px]` blob divs and without their framer-motion opacity animations on those blobs.

Context: these screens each add their own big blurred blob(s) on top of GameShell. MenuScreen (`~L41,45`) and ResultScreen (`~L44`) add static-or-animated blobs; BossScreen (`~L16`) animates a `blur-[130px]` blob with framer-motion `repeat: Infinity`. GameShell already provides ambient glow, so these are redundant.

- [ ] **Step 1: Grep tests for a dependency on these blobs**

Run: `grep -rn "blur-\[1\|data-glow\|repeat: Infinity" components/screens/MenuScreen.tsx components/screens/ResultScreen.tsx components/screens/BossScreen.tsx` and `grep -rln "MenuScreen\|ResultScreen\|BossScreen" tests/`. Confirm no test asserts a blob/animation element (they assert titles/buttons, not decorative blur). If any does, note it.

- [ ] **Step 2: Remove the redundant blobs**

In each of MenuScreen / ResultScreen / BossScreen: delete the local decorative blur-blob div(s) (the full-size `blur-[110px+]` radial-gradient divs) and any framer-motion wrapper that ONLY animated that blob's opacity/scale. Do NOT remove content, titles, buttons, or foreground motion (e.g. a title reveal) — only the background blur blobs that duplicate GameShell. If a blob is framer-motion (`motion.div` with `animate`/`repeat`), remove the whole motion.div. Read each file's imports after — drop now-unused `motion`/framer-motion imports if nothing else in the file uses them (tsc/eslint will flag).

- [ ] **Step 3: Verify**

Run: `npx vitest run tests/screens tests/ui` — Expected: all green.
Run: `npx tsc --noEmit` — clean (fix any now-unused import).

- [ ] **Step 4: Commit**

```bash
git add components/screens/MenuScreen.tsx components/screens/ResultScreen.tsx components/screens/BossScreen.tsx
git commit -m "perf(ui): drop per-screen blur blobs redundant with GameShell (Menu/Result/Boss)"
```

---

### Task 3: CollectionScreen images — intrinsic size + lazy + async decode

**Files:**
- Modify: `components/ui/PortraitImage.tsx`
- Possibly: `components/screens/CollectionScreen.tsx` (only if the tile needs to pass size)
- Test: `tests/ui/portraitImage.test.tsx` (create) or extend an existing PortraitImage test if present.

**Interfaces:**
- Produces: `PortraitImage` renders `<img>` with `loading="lazy"`, `decoding="async"`, and explicit `width`/`height` attributes (intrinsic size to reserve layout, kill CLS). Same visual size (CSS controls display size; width/height are the intrinsic ratio hint).

Context: `PortraitImage` (`components/ui/PortraitImage.tsx:37-43`) renders a plain `<img src>` with no size, no lazy. Collection mounts ~60 at once → all fetched eagerly + layout thrash. Portraits are 3:4-ish; check the actual aspect the component assumes (it's face-cropped square-ish — read the component for the real display box and pick width/height matching the source asset ratio, e.g. 300×400 or square 300×300 — inspect one portrait or the CSS to get the ratio right so the intrinsic size doesn't distort).

- [ ] **Step 1: Write the failing test**

`tests/ui/portraitImage.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { PortraitImage } from '@/components/ui/PortraitImage'

describe('PortraitImage', () => {
  it('lazy-loads, decodes async, and reserves intrinsic size', () => {
    const { container } = render(<PortraitImage id="harry" alt="Harry" />)
    const img = container.querySelector('img')!
    expect(img.getAttribute('loading')).toBe('lazy')
    expect(img.getAttribute('decoding')).toBe('async')
    expect(img.getAttribute('width')).toBeTruthy()
    expect(img.getAttribute('height')).toBeTruthy()
  })
})
```

> Implementer: read `PortraitImage.tsx` first to match its REAL prop signature (`id`/`alt`/`className`?) — adjust the render call to the actual props.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/portraitImage.test.tsx`
Expected: FAIL (no loading/decoding/width/height).

- [ ] **Step 3: Add the attributes**

In `PortraitImage.tsx`, add to the `<img>`: `loading="lazy"`, `decoding="async"`, and `width`/`height` matching the source aspect (read the component's display box + a portrait file's dimensions; pick intrinsic values with the correct ratio — the CSS `className` still controls rendered size, width/height only reserve space + hint the ratio). Do NOT change the visible rendered size or `src`.

- [ ] **Step 4: Verify**

Run: `npx vitest run tests/ui/portraitImage.test.tsx` — Expected: PASS.
Run: `npx vitest run tests/ui tests/screens` — Expected: green (CollectionScreen/other portrait users unaffected visually).
Run: `npx tsc --noEmit` — clean.

- [ ] **Step 5: Commit**

```bash
git add components/ui/PortraitImage.tsx tests/ui/portraitImage.test.tsx
git commit -m "perf(ui): PortraitImage lazy-loads + reserves intrinsic size (Collection grid)"
```

---

### Task 4: MapScreen — drop duplicate embers, swap filter-pulse for transform/opacity

**Files:**
- Modify: `components/screens/MapScreen.tsx` (+ its inline `<style>` block, ~L352-364; embers ~L96-101,173-183; `.map-current`/`.map-ember` usage)
- Test: `tests/screens/MapScreen*.test.tsx` stay green.

**Interfaces:**
- Consumes: GameShell static background (Task 1) already provides ambient glow — map's own embers are redundant.
- Produces: MapScreen renders without its 8 `.map-ember` spans; `.map-current` node "pulse" uses `transform`/`opacity` (or a static box-shadow) instead of `filter: brightness()`.

Context: MapScreen adds 8 embers on top of GameShell's (now removed) embers, and pulses the current node via `filter: brightness()` (repaint) in an inline `<style>`. Keep the current-node emphasis but make it cheap.

- [ ] **Step 1: Grep tests for map ember / current-pulse dependency**

Run: `grep -rn "map-ember\|map-current\|data-ember\|mapCurrentPulse\|mapEmberRise" tests/ components/screens/MapScreen.tsx`. Confirm no test asserts these decorative elements (map tests assert node reachability/labels/testids). Note any that do.

- [ ] **Step 2: Remove map embers + fix the pulse**

- Delete the 8 `.map-ember` spans (the `Array.from`/mapped ember `<span>`s, ~L96-101 render + ~L173-183) and their `@keyframes mapEmberRise` + `.map-ember` rule in the inline `<style>`.
- Change `.map-current`'s animation from `filter: brightness()` keyframes to a transform/opacity pulse, e.g.:
  ```css
  .map-current { animation: mapCurrentPulse 1.8s ease-in-out infinite; }
  @keyframes mapCurrentPulse { 0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.06); opacity: 0.9; } }
  ```
  (Keeps a visible "current node breathes" cue, but transform/opacity are composite-only, not a filter repaint.) Preserve `prefers-reduced-motion` handling if the block has it.
- Leave the live-edge SMIL/framer-motion path animation UNTOUCHED (already optimized).

- [ ] **Step 3: Verify**

Run: `npx vitest run tests/screens` — Expected: all map tests green.
Run: `npx tsc --noEmit` — clean.

- [ ] **Step 4: Commit**

```bash
git add components/screens/MapScreen.tsx
git commit -m "perf(ui): MapScreen drop duplicate embers + transform-based current-node pulse (no filter repaint)"
```

---

### Task 5: Full regression + handoff + push

**Files:**
- Modify: `docs/superpowers/HANDOFF.md`

- [ ] **Step 1: Full suite + typecheck + build**

Run: `npm run test` — Expected: all green.
Run: `npm run typecheck` — clean.
Run: `npm run build` — succeeds.

- [ ] **Step 2: Fix any red before proceeding** (systematic-debugging, no papering over).

- [ ] **Step 3: Update HANDOFF.md**

Add a bullet under the recent-fixes section: non-combat pages made smooth by making the GameShell background static (dropped 3 animated blur blobs + 14 embers + noise, cut blur radius), removing per-screen redundant blobs (Menu/Result/Boss), lazy+sizing Collection portraits, and dropping MapScreen's duplicate embers + filter-pulse. Note the blur radius (60px) as a look/perf lever.

- [ ] **Step 4: Commit + push**

```bash
git add docs/superpowers/HANDOFF.md
git commit -m "docs(handoff): non-combat page perf — static background pass"
git push origin master
```

---

## Self-Review notes
- **Spec coverage:** GameShell static → T1; per-screen blobs → T2; Collection images → T3; MapScreen embers+pulse → T4; regression+handoff → T5. All spec sections covered.
- **The one intended test change** (`gameShell.test.tsx` ember assertion) is explicit in T1 with the new assertion written out — not a silent break.
- **Look-invariance risk** is per-task: every task keeps the visible structure (gradients, node emphasis, portrait size) and removes only movement/redundant cost. Reviewer's lens: did any task change the visible layout/size/gradient, vs only removing animation/blur-radius/duplicate?
- **Grep-before-remove** is baked into T2/T4 step 1 so a decorative element a test depends on is caught before removal, not after.
- Blur radius 60px (T1) is a judgment call — if the user finds the glow too tight, it's a one-constant lever (noted in handoff). Not a correctness issue.
