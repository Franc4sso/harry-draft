# Premium UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every non-combat screen feel like a premium videogame — depth, texture, cinematic transitions, ambient life — without re-branding.

**Architecture:** Shared foundations first (CSS tokens/utilities, GameShell ambient layer, framer-motion primitives, premium Button/Panel), then per-screen passes that consume them. Spec: `docs/superpowers/specs/2026-07-02-premium-ui-redesign-design.md`.

**Tech Stack:** Next 16 (READ `node_modules/next/dist/docs/` before touching layout/fonts — breaking changes vs training data), Tailwind 4, framer-motion 12, vitest + testing-library.

## Global Constraints

- Combat untouched: `components/screens/BattleScreen.tsx`, `components/battle/*` out of scope.
- All `data-testid` and aria attributes preserved exactly.
- Every animation gated on `prefers-reduced-motion` (CSS media query or `useReducedMotion()`).
- Ambient/continuous effects GPU-only (transform/opacity). No new dependencies.
- Draft roster rows: NO transform on hover (documented flicker bug in globals.css:57).
- After each task: `npm run test` green AND `npm run typecheck` green (vitest does NOT typecheck).
- Working tree has unrelated changes from another process (`data/constants.ts`, `data/statuses.ts`, `tests/engine/__bisect.test.ts`) — `git add` ONLY files this plan touches; verify `git rev-parse --abbrev-ref HEAD` = master before each commit.
- Commit after each task, push at milestones.

---

### Task 1: CSS foundations (tokens, texture, elevation, keyframes)

**Files:**
- Modify: `app/globals.css`

**Interfaces:**
- Produces CSS classes used by all later tasks: `.kicker`, `.title-gradient`, `.panel-premium`, `.elev-gold`, `.noise-overlay`, `.vignette`, keyframes `emberRise`, `fogDrift`, `sheenSweep`, `shimmer` (existing `resaShimmer` kept).

- [ ] **Step 1:** Append to `app/globals.css` (keep everything existing):

```css
/* ==== Premium foundations ==== */
.kicker {
  font-family: var(--font-display);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.42em;
  color: rgb(202 162 74 / 0.85);
}
.title-gradient {
  background-image: linear-gradient(180deg, #f6ecc4 0%, #d9b65f 48%, #a9802f 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: drop-shadow(0 4px 24px rgba(202,162,74,0.35));
}
.panel-premium {
  position: relative;
  border-radius: 1rem;
  border: 1px solid rgba(255,255,255,0.09);
  background:
    linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.015) 40%, rgba(0,0,0,0.12)),
    #131020;
  box-shadow:
    0 1px 0 rgba(255,255,255,0.06) inset,
    0 -12px 32px -18px rgba(202,162,74,0.18) inset,
    0 18px 40px -18px rgba(0,0,0,0.7);
}
.elev-gold {
  box-shadow:
    0 0 0 1px rgba(243,230,160,0.4) inset,
    0 1px 0 rgba(255,255,255,0.35) inset,
    0 10px 30px rgba(176,133,58,0.35),
    0 22px 50px -18px rgba(0,0,0,0.8);
}
@keyframes emberRise {
  0%   { transform: translate3d(0, 0, 0) scale(1); opacity: 0; }
  8%   { opacity: var(--ember-peak, 0.7); }
  90%  { opacity: 0.1; }
  100% { transform: translate3d(var(--ember-drift, 20px), -85vh, 0) scale(0.4); opacity: 0; }
}
@keyframes fogDrift {
  0%   { transform: translate3d(-4%, 0, 0) scale(1); }
  50%  { transform: translate3d(4%, -3%, 0) scale(1.08); }
  100% { transform: translate3d(-4%, 0, 0) scale(1); }
}
@keyframes sheenSweep { from { transform: translateX(-130%) skewX(-18deg); } to { transform: translateX(230%) skewX(-18deg); } }
@media (prefers-reduced-motion: reduce) {
  .anim-ambient { animation: none !important; }
}
```

- [ ] **Step 2:** `npm run test && npm run typecheck` — both green (CSS only, sanity).
- [ ] **Step 3:** Commit `style: premium CSS foundations (tokens, elevation, keyframes)`.

---

### Task 2: GameShell ambient layer

**Files:**
- Create: `components/ui/GameShell.tsx`
- Modify: `app/layout.tsx` (mount behind children)
- Test: `tests/ui/gameShell.test.tsx`

**Interfaces:**
- Produces: `<GameShell />` — self-contained, `aria-hidden`, `pointer-events-none`, fixed inset-0 behind content. No props.

- [ ] **Step 1:** Write failing test `tests/ui/gameShell.test.tsx`:

```tsx
import { render } from '@testing-library/react'
import { GameShell } from '@/components/ui/GameShell'

it('renders an aria-hidden, pointer-events-none ambient layer', () => {
  const { container } = render(<GameShell />)
  const root = container.firstElementChild as HTMLElement
  expect(root).toBeTruthy()
  expect(root.getAttribute('aria-hidden')).toBe('true')
  expect(root.className).toContain('pointer-events-none')
})
```

- [ ] **Step 2:** Run — FAIL (module not found).
- [ ] **Step 3:** Implement `components/ui/GameShell.tsx`: fixed layer with 3 fog blobs (`fogDrift` 70–110s, class `anim-ambient`), ~14 ember spans (deterministic pseudo-random positions from index math, `emberRise` 9–16s staggered, class `anim-ambient`), noise overlay (inline SVG feTurbulence data-URI, opacity ~0.04), vignette (radial-gradient). All divs `aria-hidden` on root, `pointer-events-none fixed inset-0 -z-10`.
- [ ] **Step 4:** Mount in `app/layout.tsx` body before `{children}` (check Next 16 docs for layout conventions first).
- [ ] **Step 5:** Tests + typecheck green. Commit `feat(ui): GameShell ambient layer (fog, embers, noise, vignette)`.

---

### Task 3: Motion primitives

**Files:**
- Create: `components/ui/motion.tsx`
- Test: `tests/ui/motionPrimitives.test.tsx`

**Interfaces:**
- Produces:
  - `EASE_CINEMATIC: [number, number, number, number]` = `[0.22, 1, 0.36, 1]`
  - `screenVariants: Variants` (initial/animate/exit: opacity+y+scale+filter blur)
  - `<Stagger delay?: number>` / `<StaggerItem>` — cascade container/items
  - `<Reveal delay?: number>` — dramatic reveal (scale 0.92 + blur → sharp)
  - `<TiltCard max?: number>` — pointer 3D tilt wrapper (rotateX/Y clamp default 6°), inert under reduced motion

- [ ] **Step 1:** Failing test: render `<Stagger><StaggerItem>x</StaggerItem></Stagger>` and `<Reveal>y</Reveal>` and `<TiltCard>z</TiltCard>`, assert children visible in DOM.
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Implement with framer-motion (`motion.div`, `useReducedMotion`, variants with `staggerChildren: 0.07`).
- [ ] **Step 4:** Tests + typecheck green. Commit `feat(ui): motion primitives (screenVariants, Stagger, Reveal, TiltCard)`.

---

### Task 4: Premium Button + GlowPanel

**Files:**
- Modify: `components/ui/Button.tsx` (add `danger` variant; primary → gold gradient + `.elev-gold` + sheen sweep on hover + press scale; ghost refined)
- Modify: `components/ui/GlowPanel.tsx` (base on `.panel-premium`, keep `glow` prop)

**Interfaces:**
- Consumes: Task 1 classes. API unchanged (`variant?: 'primary' | 'ghost' | 'danger'`) — existing call sites keep working.

- [ ] **Step 1:** Grep call sites of `Button` and `GlowPanel`; confirm no visual-regression-sensitive testids.
- [ ] **Step 2:** Implement. Primary: gold gradient bg (`linear-gradient(180deg,#f3e0a0,#caa24a 55%,#b0853a)`), dark text `#1a1206`, `active:scale-[0.97]`, overflow-hidden sheen span on hover. Focus rings preserved.
- [ ] **Step 3:** Tests + typecheck green. Commit `feat(ui): premium Button variants + GlowPanel depth`.

---

### Task 5: RunBRunner cinematic transitions + sidebar restyle

**Files:**
- Modify: `components/screens/RunBRunner.tsx` (AnimatePresence child uses `screenVariants` + `EASE_CINEMATIC`; sidebar `<aside>` panels → `.panel-premium`, slide-in entrance)

**Interfaces:**
- Consumes: `screenVariants`, `EASE_CINEMATIC` from Task 3.

- [ ] Steps: implement → `npm run test` (PlayFlow.gate + screen tests must stay green) → typecheck → commit `feat(screens): cinematic screen transitions + premium run sidebar`.

---

### Task 6: MenuScreen polish

**Files:**
- Modify: `components/screens/MenuScreen.tsx`

Changes: title uses `.title-gradient` class (drop inline style); letter/block stagger entrance; teaser card wrapped in `<TiltCard>`; CTA uses premium Button primary (or keeps bespoke gold but with `.elev-gold` + sheen); links get underline-grow hover.

- [ ] Implement → tests + typecheck → commit `feat(menu): premium menu polish`.

---

### Task 7: DraftScreen + draft components stagger/flourish

**Files:**
- Modify: `components/screens/DraftScreen.tsx`, `components/draft/DraftBoard.tsx`, `components/draft/DraftCandidateCard.tsx`, `components/draft/SquadPanel.tsx`, `components/draft/DraftSlot.tsx`

Changes: candidates enter via `Stagger`/`StaggerItem`; pick = scale-punch + gold flash on chosen card (framer `animate` sequence); squad slot fills with spring pop; free-standing candidate cards get `TiltCard`. Roster ROWS keep no-transform hover rule.

- [ ] Implement → tests + typecheck → commit `feat(draft): staggered entrances + pick flourish`.

---

### Task 8: MapScreen — seal medallions + path drawing

**Files:**
- Modify: `components/screens/MapScreen.tsx`

Changes: nodes become layered medallions (outer accent ring + inner disc gradient + emblem, per-type `ACCENT` kept; emoji stays as emblem); active edges animate with SVG `pathLength` (framer `motion.path` initial pathLength 0 → 1, then existing dash flow); reachable nodes breathe (scale pulse, reduced-motion off); header uses `.kicker` + banner rule lines. All `data-testid`/`aria-label` intact.

- [ ] Implement → tests + typecheck → commit `feat(map): seal medallion nodes + animated path drawing`.

---

### Task 9: Recruit / RelicNode / Infirmary

**Files:**
- Modify: `components/screens/RecruitScreen.tsx`, `components/screens/RelicNodeScreen.tsx`, `components/screens/InfirmaryScreen.tsx`, `components/relics/RelicCard.tsx`

Changes: shared header pattern (`.kicker` + display title + rule); offers in `Stagger`; relic cards `Reveal` + `TiltCard`; infirmary healing pulse accent (soft green glow breathe).

- [ ] Implement → tests + typecheck → commit `feat(screens): premium recruit/relic/infirmary`.

---

### Task 10: Victory / AreaCleared cinematics

**Files:**
- Modify: `components/screens/VictoryScreen.tsx`, `components/screens/AreaClearedScreen.tsx`

Changes: staged sequence (dark beat → title `Reveal` → content stagger → CTA); gold particle burst (CSS spans, one-shot); stats/summary count-up (framer `animate` on motion value or simple spring number).

- [ ] Implement → tests + typecheck → commit `feat(screens): cinematic victory + area-cleared`.

---

### Task 11: Result (win/defeat moods) + Boss intro

**Files:**
- Modify: `components/screens/ResultScreen.tsx`, `components/screens/BossScreen.tsx`

Changes: win = triumphant gold Reveal; defeat = desaturated cold palette, slower timings, ember layer dimmed; BossScreen = menace Reveal with red/gold accents and scale-in portrait.

- [ ] Implement → tests + typecheck → commit `feat(screens): result moods + boss intro drama`.

---

### Task 12: Rules / Credits / TeamScreen consistency

**Files:**
- Modify: `components/screens/RulesScreen.tsx`, `components/screens/CreditsScreen.tsx`, `components/screens/TeamScreen.tsx`

Changes: headers → shared pattern; panels → `.panel-premium`; buttons → premium Button; entrance stagger on sections.

- [ ] Implement → tests + typecheck → commit `feat(screens): rules/credits/team consistency pass`.

---

### Task 13: Final verification

- [ ] `npm run test` full suite green.
- [ ] `npm run typecheck` green.
- [ ] `npm run dev` → walk Menu → Draft → Map → node screens → Victory → AreaCleared → Result; screenshot spot-check; confirm reduced-motion (emulate via devtools or CSS check) renders static.
- [ ] Push to origin.
