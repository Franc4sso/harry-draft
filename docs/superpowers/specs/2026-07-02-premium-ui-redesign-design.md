# Premium UI/UX Redesign — Non-Combat Screens

**Date:** 2026-07-02
**Scope:** All screens EXCEPT combat (`BattleScreen.tsx`, `components/battle/*`). Combat gets its own pass later.
**Goal:** Make the game feel like a premium videogame (reference: Slay the Spire / Hearthstone): depth, texture, cinematic transitions, ambient life. Evolve the current identity (dark + gold + house colors) — no re-branding.

## Approach

Layered "game shell": shared foundations first, then per-screen passes that consume them. Framer-motion (already installed) for orchestrated animation; CSS for ambient/continuous effects.

## 1. Foundations — tokens + `globals.css`

- Layered background: richer radial gradients (warm gold above, cold arcane below), inline SVG noise texture (feTurbulence data-URI) at low opacity, vignette. Applied via `body::before/::after` or GameShell layers.
- Elevation system: utility classes for double shadows (ambient dark + gold key light), inner bevels on gold surfaces.
- Typography: Cinzel (display) reserved for titles/kickers with consistent tracking scale; utility classes `.kicker`, `.title-gradient` (the gold gradient text currently inlined in MenuScreen becomes a class).
- Shared keyframes: `shimmer`, `float`, `ember-rise`, `sheen-sweep`. All gated behind `prefers-reduced-motion`.

## 2. GameShell — living ambient layer

New `components/ui/GameShell.tsx`, mounted once in `app/layout.tsx` behind children:

- Drifting fog: 2–3 large blurred gradient blobs, slow CSS transform loops (60–120s), GPU-only (transform/opacity).
- Floating embers/dust: ~16 CSS-only particles (absolutely positioned spans, staggered `ember-rise` animations, gold/violet tints).
- Vignette + noise overlay.
- `aria-hidden`, `pointer-events-none`, fully static under `prefers-reduced-motion`.
- Sits behind everything including battle (it is background only — battle screens visually unaffected in structure).

## 3. Motion primitives — `components/ui/motion.tsx`

Reusable framer-motion pieces, all reduced-motion aware:

- `screenVariants` + updated `RunBRunner` AnimatePresence: fade + slight scale + y + blur-in, custom ease (`[0.22, 1, 0.36, 1]`), distinct exit. Replaces the current flat opacity fade.
- `Stagger` / `StaggerItem`: cascading entrance for card grids (draft candidates, recruit offers, relic choices).
- `Reveal`: dramatic reveal (scale 0.92 + blur → sharp, optional gold flash) for relics, boss intro, victory MVP.
- `TiltCard`: pointer-tracking 3D tilt (useMotionValue/useSpring, rotateX/rotateY clamp ~6°) with moving specular highlight. Used by WizardCard-based cards on hover. NOTE: draft roster rows keep the no-transform hover rule (see comment in globals.css — hover flicker); Tilt applies only to free-standing cards, not rows.

## 4. Premium components

- `Button.tsx`: variants `primary` (gold gradient, bevel, sheen sweep on hover, press scale 0.97), `ghost`, `danger`. Focus rings preserved.
- `GlowPanel.tsx` / panel classes: double border (outer hairline + inner glow), subtle top-light gradient, optional texture.
- Section header pattern: kicker + title + rule line, used across screens for consistency.

## 5. Per-screen passes (flow order)

1. **Menu**: title with letter-stagger entrance + subtle parallax on pointer, ember density slightly higher, CTA with sheen; teaser card gets TiltCard.
2. **Draft**: candidates enter with Stagger; pick confirmation flourish (scale-punch + gold flash); squad slots fill with spring pop.
3. **Map**: nodes redesigned as wax-seal medallions (ring + emblem + per-type accent, replacing plain emoji circles — emoji kept as emblem inside); active path draws itself (SVG `pathLength` animation); reachable nodes breathe; area header as banner with kicker.
4. **Recruit / RelicNode / Infirmary**: shared section header; offers enter with Stagger; relic pick uses Reveal; infirmary gets healing pulse accents.
5. **Victory / AreaCleared**: cinematic — dark beat, then title Reveal, MVP card flourish, gold particle burst (CSS), stats count-up.
6. **Result (win/defeat)**: win = triumphant gold; defeat = desaturated, cold, slower timing. Distinct moods.
7. **Boss intro (BossScreen)**: dramatic Reveal, red/gold menace accents.
8. **Team sidebar (`withTeamSidebar` in RunBRunner)**: panel restyle to premium, slide-in entrance.
9. **Rules / Credits / TeamScreen**: consistency polish (headers, panels, buttons).

## 6. Constraints

- All `data-testid` and aria labels preserved; existing tests stay green (`npm run test`), plus `npm run typecheck` (vitest does not typecheck — known gap).
- `prefers-reduced-motion`: every continuous/entrance animation degrades to static.
- Perf: ambient effects GPU-only (transform/opacity), no layout-thrashing animations, particle count small; no new deps.
- Next 16 breaking changes: read `node_modules/next/dist/docs/` before touching `app/layout.tsx` or fonts.
- Combat untouched: `BattleScreen.tsx`, `components/battle/*` out of scope (GameShell background behind them is acceptable).

## 7. Testing

- Existing suites green after each phase.
- Typecheck after each phase.
- New primitives (`motion.tsx`, `GameShell`) get light render tests (mount, reduced-motion branch).
- Manual visual pass via `npm run dev` at the end of each screen pass.
