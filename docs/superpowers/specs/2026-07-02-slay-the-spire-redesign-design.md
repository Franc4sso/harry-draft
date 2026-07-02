# "Sala Comune" Redesign — Slay-the-Spire Look, Non-Combat Screens

**Date:** 2026-07-02
**Supersedes the timid first pass** (`2026-07-02-premium-ui-redesign-design.md`): keeps its shared-foundations architecture (GameShell, motion primitives, CSS tokens) but replaces the visual language with a bolder, hand-painted, textured direction and recomposes screen layouts.
**Scope:** All non-combat screens. Combat (`BattleScreen`, `components/battle/*`) still out of scope.
**Reference:** Slay the Spire — hand-painted, warm/sooty, thick ornate frames, node-map as the hero, heavy satisfying motion (not nervous). Harry Potter vibes: warm, diegetic (candlelight, parchment, wax seals, house accents) — tasteful, never parody.

## Non-negotiables (user-stated)

1. **Legibility first.** Texture and frames sit *under and around* content, never behind live text. Every string lives on a solid dark base at full contrast. Parchment is ambience, not paragraph background.
2. **Structural coherence.** One shared component/material system; every screen speaks the same language. No screen diverges.
3. **Clean AND spectacular.** Composition and hierarchy carry the "serious project" feel — effects are secondary.
4. **Reduced-motion**: every entrance/continuous animation degrades to static.

## 1. Design language: "Sala Comune"

**Palette (warm, sooty — not black-glass):**
- Stage bg: ink-brown `#1a1410` with heavy vignette + parchment grain (SVG feTurbulence, low opacity). Never flat.
- Surfaces: dark leather/parchment `#241c15`, subtle mottling.
- **Gold as material:** 3-stop `#f6e6a8 → #caa24a → #8a6420` for frames + signature text, with inner bevel highlight.
- Accents: warm brass default; arcane violet `#7c5cff` only for "magic happening"; deep crimson `#a12a2a` for danger/boss.
- House colors retained but rebased: desaturated fill + saturated edge so they read *lit*, not painted.

**Typography:** Cinzel display, real scale — hero 68 / title 38 / section 20 / label 11 uppercase-tracked. Body Inter, tightened. Signature move: display headings get a **one-shot gold-foil sheen** on entrance (masked gradient sweep across letters). Body text never textured — always solid high-contrast.

**Reusable materials (this is what was missing):**
- `frame-thick` — the StS signature: thick painted double-gold border with ornamental corner pieces (SVG). Panels + cards use it. NOT `border: 1px`.
- `parchment` — textured parchment surface for content areas (kept dim so overlaid text stays legible).
- `emboss` — text/icons pressed into material (inner shadow).
- `seal` — round wax-seal treatment for buttons/nodes.

**Signature element (where boldness is spent):** the **self-drawing gold divider** — a thin rule that animates from center outward with a traveling light node, placed under every title. The recognizable through-line across all screens; cheap (transform/opacity only).

**Motion (StS-style):** heavy and satisfying, not nervous. Entrances land with weight (scale + settle spring), hover scales + lights up, no glow pulsing everywhere. `EASE_CINEMATIC` retained for screen transitions.

## 2. Shared primitives (new/expanded)

Consolidate into a small, focused set so screens compose, not reinvent:
- `components/ui/Frame.tsx` — `frame-thick` container (variant: `panel | card | round`), renders ornamental corners + gold rim. Content slot is a solid dark surface.
- `components/ui/Parchment.tsx` — textured ambience layer (aria-hidden), used as a section/screen backdrop behind a Frame.
- `components/ui/Insegna.tsx` — standard screen header: kicker + foil-sheen title + self-drawing divider. Every screen uses it.
- `components/ui/SealButton.tsx` — primary CTA as a large gold wax-seal (replaces timid link CTAs). Ghost/danger variants via existing Button.
- Extend `components/ui/motion.tsx`: `FoilText` (one-shot sheen), `DrawDivider` (self-drawing rule), keep `Stagger/Reveal/TiltCard/screenVariants`.
- CSS tokens/materials in `globals.css`: `.frame-thick`, `.parchment`, `.emboss`, `.seal`, foil + divider keyframes. All reduced-motion gated.

GameShell reworked: warm candlelit sala-comune ambience (drifting warm light, floating dust/embers, parchment grain, heavy vignette) — replaces the cool blue-violet fog.

## 3. Map tree — hero screen + flicker fix

**Flicker root cause (confirmed):** the live edge runs two animation systems on the same path — framer-motion `pathLength` AND the CSS `.map-trail` (`stroke-dashoffset` loop) — while `strokeDasharray` is set manually. `pathLength` internally rewrites the dash array, so the two fight every frame. `filter: blur()` on a stroked path also flickers cross-browser.

**Fix (separate responsibilities):**
- Edge stroke draws **once** via `pathLength` only, no manual dasharray, no blur.
- The flowing light becomes a **separate layer**: a small light node travelling the path via `<animateMotion>`/`offset-path`, independent of the stroke.
- The soft glow becomes a **static wider twin path** at low opacity, not a blur filter.

**Map redesign (StS):**
- Painted trail: thick chalk/parchment-colored line, slightly irregular (hand-drawn feel), not a 1.5px wire.
- Nodes = thick-framed medallions (`frame-thick` round + rivets), embossed icon. Reachable: gold frame breathing. Current: pulses with aura. Resolved: dimmed, half-sunk.
- Live edges toward reachable nodes: living gold with travelling light; others are spent grooves.
- Header = `Insegna` banner.
- Node labels stay on solid dark chips above the texture (legibility rule).

## 4. Screen recomposition

Shared layout law: **central stage + Insegna on top + actions anchored at bottom.** Strong hierarchy, real breathing room, one focal point per screen.

- **Menu** — the game's poster. Huge forged title, weighty levitating teaser card, big unmistakable `SealButton` "Gioca" anchored low (not three timid links; Compendio/Credits become smaller framed secondary buttons). Sala-comune warm-fire backdrop.
- **Draft** — keep two columns (candidates / synergies) but strong hierarchy: fixed Insegna header, candidate cards framed, cascade-in with weight; synergy rail becomes a real `Parchment`+`Frame` panel; squad row = medallion slots, not chips.
- **Map** — §3, the hero, vertical painted trail, scrolls like StS.
- **Recruit / Relic / Infirmary** — same chassis: Insegna → stage content → anchored actions. Relic = artifacts on lit pedestals raised to full quality. Full coherence with draft.
- **Victory / AreaCleared / Result / Boss** — "scene" screens: dark beat → dramatic forged-title reveal → parchment summary panel → one moment (gold burst / cold pallor / crimson menace). Theatrical vertical-centered composition, light letterbox.

## 5. Constraints

- Preserve all `data-testid` and aria attributes; existing tests + typecheck stay green (vitest does not typecheck — run `tsc` too).
- No new dependencies; textures are CSS/SVG procedural (designed so single textures can later be swapped for image assets where more painterly impact is wanted — not now).
- GPU-only ambient effects (transform/opacity); small particle counts; no layout-thrash.
- Next 16 breaking changes: consult `node_modules/next/dist/docs/` before touching layout/fonts.
- Working tree has a concurrent balance process editing `data/` + `game/engine/` + engine tests; `git add` only files this work touches; verify HEAD = master before each commit.

## 6. Testing

- Existing suites green after each phase; typecheck green.
- New primitives (`Frame`, `Parchment`, `Insegna`, `SealButton`, `FoilText`, `DrawDivider`) get light render tests (mount, reduced-motion branch, testid/aria passthrough).
- Map: a test asserting the live edge renders a single stroke path (no dual-animation regression) — guards the flicker fix.
- Manual visual pass via dev server + screenshots at each screen.
