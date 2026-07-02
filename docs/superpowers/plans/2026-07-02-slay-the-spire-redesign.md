# Sala Comune Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every non-combat screen a bold, hand-painted Slay-the-Spire look (warm/sooty parchment, thick gold frames, painted node-map) with strong recomposed layouts, and fix the map-tree edge flicker — while keeping text fully legible and the component system coherent.

**Architecture:** Build a small shared material+primitive system first (`Frame`, `Parchment`, `Insegna`, `SealButton`, `FoilText`, `DrawDivider`, plus CSS materials `.frame-thick`/`.parchment`/`.emboss`/`.seal`), rework GameShell to warm ambience, then recompose each screen on top. Spec: `docs/superpowers/specs/2026-07-02-slay-the-spire-redesign-design.md`.

**Tech Stack:** Next 16 (READ `node_modules/next/dist/docs/` before touching layout/fonts), Tailwind 4, framer-motion 12, vitest + testing-library.

## Global Constraints

- Combat untouched: `components/screens/BattleScreen.tsx`, `components/battle/*` out of scope.
- **Legibility law:** texture/frames sit under/around content, never behind live text. Every string on a solid dark base at full contrast. Parchment is dim ambience.
- All `data-testid` + aria attributes preserved exactly.
- Every entrance/continuous animation gated on `prefers-reduced-motion`.
- GPU-only ambient effects (transform/opacity). No new dependencies. Textures are CSS/SVG procedural.
- After each task: `npm run test` green AND `npm run typecheck` green (vitest does NOT typecheck).
- Concurrent balance process edits `data/` + `game/engine/` + engine tests; `git add`/`git commit` only with explicit pathspecs for files THIS plan touches; verify `git rev-parse --abbrev-ref HEAD` = master before each commit. Do NOT stage `data/*`, `game/engine/*`, `tests/engine/*`, or `public/portraits/*`.
- Existing gold classes from prior pass live in `app/globals.css` (`.kicker`, `.title-gradient`, `.panel-premium`, `.elev-gold`, `.btn-sheen`) and `components/ui/motion.tsx` (`EASE_CINEMATIC`, `screenVariants`, `Stagger`, `StaggerItem`, `Reveal`, `TiltCard`) — REUSE/extend, don't duplicate.
- `houseTheme(house)` in `lib/theme.ts` returns `{ color, glow, gradient, ring }` — use for house tinting.
- Commit after each task; push at milestones (tasks 4, 8, 12).

---

### Task 1: CSS materials — frame-thick, parchment, emboss, seal, foil, divider

**Files:**
- Modify: `app/globals.css` (append after existing premium block, end of file)

**Interfaces:**
- Produces CSS classes: `.frame-thick`, `.frame-corner`, `.parchment`, `.emboss`, `.seal`; keyframes `foilSweep`, `dividerDraw`, `dividerNode`, `warmDrift`. All reduced-motion gated.

- [ ] **Step 1:** Append to `app/globals.css`:

```css
/* ==== Sala Comune materials (Slay-the-Spire look) ==== */
:root {
  --ink: #1a1410;
  --leather: #241c15;
  --gold-1: #f6e6a8;
  --gold-2: #caa24a;
  --gold-3: #8a6420;
  --arcane: #7c5cff;
  --crimson: #a12a2a;
}
/* Thick painted double-gold frame. Wrap content in a solid-dark child so text stays legible. */
.frame-thick {
  position: relative;
  border-radius: 14px;
  padding: 3px;
  background:
    linear-gradient(160deg, var(--gold-1) 0%, var(--gold-2) 42%, var(--gold-3) 100%);
  box-shadow:
    0 2px 0 rgba(255,255,255,0.18) inset,
    0 18px 44px -18px rgba(0,0,0,0.85),
    0 0 22px -6px rgba(202,162,74,0.35);
}
.frame-thick > .frame-inner {
  position: relative;
  border-radius: 11px;
  background:
    radial-gradient(120% 90% at 50% 0%, rgba(255,255,255,0.04), transparent 55%),
    var(--leather);
  box-shadow: 0 0 0 1px rgba(0,0,0,0.6) inset, 0 10px 30px -16px rgba(0,0,0,0.9) inset;
  overflow: hidden;
}
/* Parchment ambience — dim, textural, sits BEHIND content (never behind live text). */
.parchment {
  background-color: #2a2016;
  background-image:
    radial-gradient(140% 120% at 50% -10%, rgba(90,66,36,0.35), transparent 60%),
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='p'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23p)' opacity='0.35'/%3E%3C/svg%3E");
  background-blend-mode: overlay;
}
.emboss { text-shadow: 0 1px 0 rgba(0,0,0,0.7), 0 -1px 0 rgba(255,255,255,0.06); }
/* Round wax-seal surface for CTAs / map nodes. */
.seal {
  background:
    radial-gradient(circle at 50% 30%, rgba(255,255,255,0.18), transparent 45%),
    linear-gradient(180deg, var(--gold-1) 0%, var(--gold-2) 52%, var(--gold-3) 100%);
  box-shadow:
    0 2px 0 rgba(255,255,255,0.35) inset,
    0 -6px 14px -6px rgba(0,0,0,0.5) inset,
    0 12px 28px -10px rgba(0,0,0,0.8),
    0 0 18px -4px rgba(202,162,74,0.5);
}
@keyframes foilSweep { from { background-position: -180% 0; } to { background-position: 280% 0; } }
@keyframes dividerDraw { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@keyframes dividerNode { 0% { left: 8%; opacity: 0; } 15% { opacity: 1; } 85% { opacity: 1; } 100% { left: 92%; opacity: 0; } }
@keyframes warmDrift {
  0% { transform: translate3d(-3%, 0, 0) scale(1); }
  50% { transform: translate3d(3%, -2%, 0) scale(1.06); }
  100% { transform: translate3d(-3%, 0, 0) scale(1); }
}
@media (prefers-reduced-motion: reduce) {
  .frame-thick, .seal { }
}
```

- [ ] **Step 2:** `npm run test && npm run typecheck` — both green (CSS only).
- [ ] **Step 3:** `git commit -m "style: Sala Comune materials (frame-thick, parchment, emboss, seal)" -- app/globals.css`

---

### Task 2: Frame + Parchment primitives

**Files:**
- Create: `components/ui/Frame.tsx`, `components/ui/Parchment.tsx`
- Test: `tests/ui/frame.test.tsx`

**Interfaces:**
- Produces: `<Frame variant?: 'panel'|'card'|'round' className?>{children}</Frame>` — renders `.frame-thick` outer + `.frame-inner` solid-dark child holding children; `round` uses circular radius. Passes through `data-testid`, `role`, `onClick`, `tabIndex`, `aria-*` to the outer element.
- `<Parchment className?>{children}</Parchment>` — `.parchment` layer, `aria-hidden` false (it can hold content but keeps it dim); children wrapped so text is placed by caller on solid bases.

- [ ] **Step 1:** Write failing test `tests/ui/frame.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Frame } from '@/components/ui/Frame'

describe('Frame', () => {
  it('wraps children in a solid inner surface and forwards testid', () => {
    render(<Frame data-testid="f">hi</Frame>)
    const el = screen.getByTestId('f')
    expect(el.className).toContain('frame-thick')
    expect(el.querySelector('.frame-inner')?.textContent).toBe('hi')
  })
})
```

- [ ] **Step 2:** Run `npx vitest run tests/ui/frame.test.tsx` — FAIL (module missing).
- [ ] **Step 3:** Implement `components/ui/Frame.tsx`:

```tsx
import { cn } from '@/lib/cn'

type Variant = 'panel' | 'card' | 'round'

export function Frame({
  children, variant = 'panel', className, innerClassName, ...rest
}: {
  children: React.ReactNode
  variant?: Variant
  className?: string
  innerClassName?: string
} & React.HTMLAttributes<HTMLDivElement>) {
  const radius = variant === 'round' ? 'rounded-full [&>.frame-inner]:rounded-full' : ''
  return (
    <div {...rest} className={cn('frame-thick', radius, className)}>
      <div className={cn('frame-inner h-full w-full', innerClassName)}>{children}</div>
    </div>
  )
}
```

- [ ] **Step 4:** Implement `components/ui/Parchment.tsx`:

```tsx
import { cn } from '@/lib/cn'

export function Parchment({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <div className={cn('parchment', className)}>{children}</div>
}
```

- [ ] **Step 5:** Run test — PASS. `npm run typecheck` green.
- [ ] **Step 6:** `git commit -m "feat(ui): Frame + Parchment material primitives" -- components/ui/Frame.tsx components/ui/Parchment.tsx tests/ui/frame.test.tsx`

---

### Task 3: FoilText + DrawDivider + Insegna header

**Files:**
- Modify: `components/ui/motion.tsx` (add `FoilText`, `DrawDivider`)
- Create: `components/ui/Insegna.tsx`
- Test: `tests/ui/insegna.test.tsx`

**Interfaces:**
- Consumes: `EASE_CINEMATIC` (existing in motion.tsx).
- Produces:
  - `<FoilText as?: 'h1'|'h2'|'span' className?>{text}</FoilText>` — gold gradient text with one-shot `foilSweep` sheen on mount; static under reduced motion. Sets accessible text as the element's textContent.
  - `<DrawDivider className? widthClass?>` — self-drawing gold rule (scaleX 0→1) + travelling light node; static under reduced motion; `aria-hidden`.
  - `<Insegna kicker? title actions?>` — screen header: optional `.kicker`, `FoilText` h1 title, `DrawDivider`. `title: string`, `kicker?: string`.

- [ ] **Step 1:** Failing test `tests/ui/insegna.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Insegna } from '@/components/ui/Insegna'
import { FoilText, DrawDivider } from '@/components/ui/motion'

describe('Insegna + foil primitives', () => {
  it('renders kicker + accessible title heading', () => {
    render(<Insegna kicker="Sala" title="Reclutamento" />)
    expect(screen.getByText('Sala')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Reclutamento' })).toBeTruthy()
  })
  it('FoilText exposes its text; DrawDivider is decorative', () => {
    const { container } = render(<><FoilText>Ciao</FoilText><DrawDivider /></>)
    expect(screen.getByText('Ciao')).toBeTruthy()
    expect(container.querySelector('[aria-hidden="true"]')).toBeTruthy()
  })
})
```

- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Add to `components/ui/motion.tsx` (append; keep existing exports):

```tsx
export function FoilText({
  children, as = 'span', className,
}: { children: React.ReactNode; as?: 'h1' | 'h2' | 'span'; className?: string }) {
  const reduce = useReducedMotion()
  const Tag = motion[as]
  return (
    <Tag
      className={className}
      style={{
        backgroundImage: 'linear-gradient(100deg, #8a6420 0%, #caa24a 30%, #f6e6a8 50%, #caa24a 70%, #8a6420 100%)',
        backgroundSize: '220% 100%',
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        color: 'transparent',
        filter: 'drop-shadow(0 3px 18px rgba(202,162,74,0.35))',
      }}
      initial={reduce ? false : { backgroundPosition: '-180% 0' }}
      animate={{ backgroundPosition: reduce ? '50% 0' : '280% 0' }}
      transition={reduce ? { duration: 0 } : { duration: 1.4, ease: EASE_CINEMATIC }}
    >
      {children}
    </Tag>
  )
}

export function DrawDivider({ className, widthClass = 'w-56' }: { className?: string; widthClass?: string }) {
  const reduce = useReducedMotion()
  return (
    <div aria-hidden className={`relative mx-auto h-px ${widthClass} ${className ?? ''}`}>
      <motion.div
        className="absolute inset-0 origin-center"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(202,162,74,0.9), transparent)' }}
        initial={reduce ? false : { scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={reduce ? { duration: 0 } : { duration: 0.7, ease: EASE_CINEMATIC, delay: 0.15 }}
      />
      {!reduce && (
        <motion.span
          className="absolute top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full"
          style={{ background: '#f6e6a8', boxShadow: '0 0 10px #f6e6a8' }}
          initial={{ left: '8%', opacity: 0 }}
          animate={{ left: ['8%', '92%'], opacity: [0, 1, 1, 0] }}
          transition={{ duration: 0.9, ease: EASE_CINEMATIC, delay: 0.2 }}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 4:** Create `components/ui/Insegna.tsx`:

```tsx
import { FoilText, DrawDivider } from './motion'

export function Insegna({
  kicker, title, className,
}: { kicker?: string; title: string; className?: string }) {
  return (
    <div className={`text-center ${className ?? ''}`}>
      {kicker && <p className="kicker">{kicker}</p>}
      <FoilText as="h1" className="mt-1 block font-display text-4xl font-bold sm:text-5xl">{title}</FoilText>
      <DrawDivider className="mt-3" />
    </div>
  )
}
```

- [ ] **Step 5:** Run tests — PASS. `npm run typecheck` green.
- [ ] **Step 6:** `git commit -m "feat(ui): FoilText, DrawDivider, Insegna header primitives" -- components/ui/motion.tsx components/ui/Insegna.tsx tests/ui/insegna.test.tsx`

---

### Task 4: SealButton + GameShell warm ambience

**Files:**
- Create: `components/ui/SealButton.tsx`
- Modify: `components/ui/GameShell.tsx` (warm sala-comune ambience)
- Test: `tests/ui/sealButton.test.tsx`

**Interfaces:**
- Produces: `<SealButton onClick? disabled? className?>{children}</SealButton>` — large gold `.seal` CTA, press scale, sheen, focus ring, forwards `data-testid`/aria.
- GameShell: keeps `aria-hidden`, `pointer-events-none fixed inset-0 -z-10`, keeps `data-ember`/`data-fog` test hooks, recolored warm (amber/brass drift + dust), parchment grain, heavy vignette.

- [ ] **Step 1:** Failing test `tests/ui/sealButton.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SealButton } from '@/components/ui/SealButton'

describe('SealButton', () => {
  it('fires onClick and applies seal material', async () => {
    const fn = vi.fn()
    render(<SealButton onClick={fn}>Gioca</SealButton>)
    const b = screen.getByRole('button', { name: 'Gioca' })
    expect(b.className).toContain('seal')
    await userEvent.click(b)
    expect(fn).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Implement `components/ui/SealButton.tsx`:

```tsx
'use client'
import { cn } from '@/lib/cn'

export function SealButton({
  children, onClick, disabled, className, ...rest
}: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  className?: string
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'seal btn-sheen-host relative overflow-hidden rounded-2xl px-12 py-4 font-display text-base font-bold uppercase tracking-[0.22em] text-[#241206] emboss',
        'transition-transform duration-200 hover:-translate-y-0.5 active:scale-[0.97]',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f6e6a8] focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:opacity-45 disabled:cursor-not-allowed disabled:active:scale-100',
        className,
      )}
    >
      {!disabled && <span aria-hidden className="btn-sheen" />}
      <span className="relative">{children}</span>
    </button>
  )
}
```

- [ ] **Step 4:** Rework `components/ui/GameShell.tsx` — keep structure/test hooks, recolor warm. Fog blobs use amber/brass (`rgba(202,162,74,..)`, `rgba(140,90,40,..)`, `rgba(90,50,20,..)`) with `warmDrift`; embers warm gold/amber; grain via `.parchment`-style noise overlay; heavier vignette. Keep `data-fog`/`data-ember`, `aria-hidden`, `anim-ambient`.
- [ ] **Step 5:** Run `npx vitest run tests/ui` — PASS (gameShell test still green). `npm run typecheck` green.
- [ ] **Step 6:** `git commit -m "feat(ui): SealButton CTA + warm Sala Comune GameShell" -- components/ui/SealButton.tsx components/ui/GameShell.tsx tests/ui/sealButton.test.tsx` then `git push origin master`.

---

### Task 5: Map flicker fix + painted-trail redesign (hero)

**Files:**
- Modify: `components/screens/MapScreen.tsx`
- Test: `tests/screens/mapTrail.test.tsx`

**Interfaces:**
- Consumes: `Frame`, `Insegna`, `houseTheme` not needed; uses existing `ACCENT`/`ICON`/`LABEL` maps.
- Produces: no exported API change; internal render only.

- [ ] **Step 1:** Failing regression test `tests/screens/mapTrail.test.tsx` — asserts the live edge renders exactly ONE stroked `<path>` (no dual-animation). Minimal 2-node map:

```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { MapScreen } from '@/components/screens/MapScreen'
import type { RunNode } from '@/types'

const map: RunNode[] = [
  { id: 'a0f0n0', type: 'battle', next: ['a0f1n0'], resolved: false } as RunNode,
  { id: 'a0f1n0', type: 'elite', next: [], resolved: false } as RunNode,
]

describe('map live trail', () => {
  it('renders a single stroked path per live edge (no dual-animation flicker)', () => {
    const { container } = render(
      <MapScreen map={map} currentNodeId="a0f0n0" reachableIds={['a0f1n0']} onChoose={() => {}} area={0} areasTotal={1} />,
    )
    // Live edge: one main stroke marked data-live-edge; glow twin is aria-hidden data-edge-glow.
    expect(container.querySelectorAll('[data-live-edge]').length).toBe(1)
    expect(container.querySelectorAll('[data-edge-glow]').length).toBe(1)
  })
})
```

- [ ] **Step 2:** Run — FAIL (attributes absent).
- [ ] **Step 3:** Rewrite the edge-render block in `MapScreen.tsx` (lines ~99-140). Remove the manual `strokeDasharray` + `.map-trail` on the live path and the `filter: blur()`. Structure per live edge:
  - static wide glow twin: `<path data-edge-glow aria-hidden stroke="rgba(202,162,74,0.22)" strokeWidth={7} />` (no animation, no blur)
  - main stroke: `<motion.path data-live-edge stroke="var(--gold-2)" strokeWidth={3.5} strokeLinecap="round" initial={{pathLength:0}} animate={{pathLength:1}} transition={{duration:0.9,ease:[0.22,1,0.36,1],delay:0.2}} />` (NO dasharray)
  - travelling light: a `<circle r={3} fill="#f6e6a8">` with `<animateMotion dur="1.8s" repeatCount="indefinite" path={d} />` (SMIL, independent of the stroke) — gated: only render when `!reduce`.
  - Non-live edges: single spent-groove `<path stroke="rgba(255,255,255,0.10)" strokeWidth={2} />`.
  Remove `.map-trail` keyframe usage; delete the `mapTrailFlow`/`.map-trail` from the inline `<style>` block (keep `mapCurrentPulse`, `mapBreathe`).
- [ ] **Step 4:** Redesign nodes: wrap each node button's inner in `Frame variant="round"` look via the existing button styling upgraded to thick gold ring + `.emboss` icon; reachable ring breathes, current pulses, resolved dimmed. Trail line thicker/painted (strokeWidth already raised). Header → `<Insegna kicker={`Area ${area+1} / ${areasTotal}`} title="Scegli il cammino" />` replacing current header block. Keep all `data-testid={`node-${n.id}`}`, `aria-label`, telegraph markup intact.
- [ ] **Step 5:** Run `npx vitest run tests/screens tests/ui` — PASS. `npm run typecheck` green.
- [ ] **Step 6:** `git commit -m "fix(map): flicker (separate stroke/glow/light) + painted-trail redesign" -- components/screens/MapScreen.tsx tests/screens/mapTrail.test.tsx`

---

### Task 6: Menu recomposition (poster layout + SealButton)

**Files:**
- Modify: `components/screens/MenuScreen.tsx`

- [ ] **Step 1:** Recompose: keep `aria-label="Harry Draft"` heading (letter spans OK) but title uses larger scale; teaser `WizardCard` in `TiltCard` with heavier float; primary CTA → `<SealButton onClick={play} data-testid="play-cta">Gioca</SealButton>` large and anchored; "Continua run" secondary; Compendio/Credits become small framed secondary links (wrap in `Frame variant="panel"` pill or keep as `Button variant="ghost"` for consistency). Backdrop inherits warm GameShell.
- [ ] **Step 2:** Run `npx vitest run tests/ui/screens.test.tsx` — the existing MenuScreen test (`heading name 'Harry Draft'`, buttons/links) must stay green; adjust selectors in test ONLY if a link became a button, updating `tests/ui/screens.test.tsx` accordingly.
- [ ] **Step 3:** `npm run test && npm run typecheck` green.
- [ ] **Step 4:** `git commit -m "feat(menu): poster recomposition + seal CTA" -- components/screens/MenuScreen.tsx tests/ui/screens.test.tsx`

---

### Task 7: Draft recomposition (framed candidates + parchment rail + medallion squad)

**Files:**
- Modify: `components/screens/DraftScreen.tsx`, `components/draft/SquadPanel.tsx`

- [ ] **Step 1:** DraftScreen: header block → `<Insegna kicker={`Pesca ${picks.length+1} / ${target}`} title="Scegli il mago" />` (keep sticky wrapper + SquadPanel + synergy counter). Candidate section keeps `Stagger`; wrap the synergy rail (`sticky top-28` div) in `Parchment` + `Frame variant="panel"` (content on solid inner). Keep `data-testid="draft-screen"`, `draft-pick-${i}`.
- [ ] **Step 2:** SquadPanel: filled picks → medallion slots (small `Frame variant="round"` with house-tinted inner + initial), empties → dashed round frame. Keep `data-empty`.
- [ ] **Step 3:** Run `npx vitest run tests/screens tests/ui` — PASS (RecruitScreen column test relies on DraftScreen parity; DraftScreen structure kept). `npm run typecheck` green.
- [ ] **Step 4:** `git commit -m "feat(draft): framed candidates, parchment synergy rail, medallion squad" -- components/screens/DraftScreen.tsx components/draft/SquadPanel.tsx`

---

### Task 8: Recruit / Relic / Infirmary chassis

**Files:**
- Modify: `components/screens/RecruitScreen.tsx`, `components/screens/RelicNodeScreen.tsx`, `components/screens/InfirmaryScreen.tsx`

- [ ] **Step 1:** Recruit: header → `<Insegna kicker="Nuovo alleato" title="Reclutamento" />`; `ActivationRail` wrapper div (`.panel-premium`) → `Frame variant="panel"` + Parchment. Keep `recruit-${id}`, `replace-${id}`, `dead-badge-${id}`, the `as="section"` Stagger.
- [ ] **Step 2:** Relic: header → `<Insegna kicker="Sala dei tesori" title="Scegli una reliquia" />`; each `Pedestal` wrapped/rebuilt with `Frame variant="card"` + lit pedestal base; keep `relic-${id}`, `assign-carrier-${id}`, `relic-aura` keyframe.
- [ ] **Step 3:** Infirmary: crest panel → `Frame variant="panel"` on Parchment, keep healing pulse + Stagger roster + `Reveal`.
- [ ] **Step 4:** Run `npx vitest run tests/screens tests/ui` — PASS. `npm run typecheck` green.
- [ ] **Step 5:** `git commit -m "feat(screens): recruit/relic/infirmary Sala Comune chassis" -- components/screens/RecruitScreen.tsx components/screens/RelicNodeScreen.tsx components/screens/InfirmaryScreen.tsx` then `git push origin master`.

---

### Task 9: Victory / AreaCleared scene screens

**Files:**
- Modify: `components/screens/VictoryScreen.tsx`, `components/screens/AreaClearedScreen.tsx`

- [ ] **Step 1:** Victory: title → `FoilText`; summary `GlowPanel` → `Frame variant="panel"` on Parchment; keep GoldBurst, CountUp, staged reveals, `SealButton` for next action. AreaCleared: `Insegna` + `Frame` summary; keep Reveal + Button. Theatrical vertical-centered composition, subtle letterbox (top/bottom `max-w`/padding).
- [ ] **Step 2:** Run `npx vitest run tests/screens tests/ui` — PASS. `npm run typecheck` green.
- [ ] **Step 3:** `git commit -m "feat(screens): victory + area-cleared scene composition" -- components/screens/VictoryScreen.tsx components/screens/AreaClearedScreen.tsx`

---

### Task 10: Result / Boss scene screens

**Files:**
- Modify: `components/screens/ResultScreen.tsx`, `components/screens/BossScreen.tsx`

- [ ] **Step 1:** Result: win title `FoilText` + gold mood; defeat cold desaturated + slower; seed panel → `Frame`. Boss: `FoilText` crimson-tinted title, `Frame` + crimson menace wash, `Button variant="danger"` begin. Keep copy + testids.
- [ ] **Step 2:** Run `npx vitest run tests/screens tests/ui` — PASS. `npm run typecheck` green.
- [ ] **Step 3:** `git commit -m "feat(screens): result + boss scene composition" -- components/screens/ResultScreen.tsx components/screens/BossScreen.tsx`

---

### Task 11: Rules / Credits / Team consistency + run sidebar

**Files:**
- Modify: `components/screens/RulesScreen.tsx`, `components/screens/CreditsScreen.tsx`, `components/screens/TeamScreen.tsx`, `components/screens/RunBRunner.tsx`

- [ ] **Step 1:** Rules/Credits/Team headers → `<Insegna>`; GlossaryCard/panels → `Frame variant="panel"` on Parchment; tabs keep gold active. Team squad synergy chips + roster consistent. RunBRunner sidebar panels (`.panel-premium`) → `Frame variant="panel"`. Keep all testids.
- [ ] **Step 2:** Run `npm run test` (full) — green. `npm run typecheck` green.
- [ ] **Step 3:** `git commit -m "feat(screens): rules/credits/team + run sidebar consistency" -- components/screens/RulesScreen.tsx components/screens/CreditsScreen.tsx components/screens/TeamScreen.tsx components/screens/RunBRunner.tsx`

---

### Task 12: Final verification + push

- [ ] **Step 1:** `npm run test` full suite — green except any pre-existing concurrent-process engine failures (`data/`/`game/engine/` files — NOT ours). Confirm failing files are outside our scope with `git diff --name-only`.
- [ ] **Step 2:** `npm run typecheck` — green.
- [ ] **Step 3:** `npm run build` — succeeds.
- [ ] **Step 4:** `npm run dev`, screenshot Menu → Draft → Map (verify NO edge flicker) → node screens → Victory → Result. Confirm reduced-motion renders static.
- [ ] **Step 5:** `git push origin master`.
