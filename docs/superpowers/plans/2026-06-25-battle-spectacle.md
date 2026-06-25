# Battle Spectacle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Invert teams (mine on top), expand cards with stat bars, move the status legend to the side, show control turns, separate mine/enemy synergies+relics, make the initiative bar vertical with faces + side identity, drop the action counter, and add a "spinto ma sicuro" spectacle pass — all presentational.

**Architecture:** Every change is in `components/battle/**` + `components/screens/BattleScreen.tsx`. No engine/data changes. New small components: `ArenaBackdrop`, `StatBar`. The battle screen becomes a 3-column grid (initiative | arena | legend) on `lg`, stacking below it.

**Tech Stack:** Next.js (custom fork — read `node_modules/next/dist/docs/` before any Next-specific code), React, TypeScript, framer-motion, lucide-react, Tailwind, Vitest + Testing Library.

## Global Constraints

- Test runner: `npm run test` (Vitest). **Vitest does NOT typecheck** — after any `.ts`/`.tsx` edit, run `npx tsc --noEmit` and confirm 0 errors.
- All user-facing copy is **Italian** (match existing strings).
- **No engine/data changes.** Only `components/**`. Deterministic: no `Math.random`/`Date.now`.
- Every animation must degrade to a static final state under `useReducedMotion()`.
- Known flaky tests: `tests/ui/playFlow.test.tsx` and `tests/ui/campaignRunner.test.tsx` are parallel-timeout flakes that PASS in isolation (`npx vitest run <file>`). If one is the only red, confirm isolated, then it's fine. Any OTHER red is real.
- Commit after every task. Work on `master`; a concurrent writer may commit to master mid-session — verify `git rev-parse HEAD` before each commit and never `--amend` a commit that is no longer HEAD. Push only at the final task.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `components/battle/StatBar.tsx` | one labeled stat bar (icon + value + proportional fill + buff tint) | Create |
| `components/battle/ArenaBackdrop.tsx` | animated decorative arena layer | Create |
| `components/battle/UnitBust.tsx` | stat bars; control-overlay turns; impact flash/shake; aura pulse | Modify |
| `components/battle/InitiativeBar.tsx` | vertical, faces, side identity | Modify |
| `components/battle/StatusLegend.tsx` | side/vertical layout variant | Modify |
| `components/battle/SynergyRibbon.tsx` | `title` + `tone` header/accent | Modify |
| `components/battle/BattleArena.tsx` | invert rows; mount backdrop | Modify |
| `components/screens/BattleScreen.tsx` | 3-col grid; labeled ribbons; remove action counter | Modify |

---

## Task 1: Remove the action counter (header)

**Files:**
- Modify: `components/screens/BattleScreen.tsx:56-59`
- Test: `tests/ui/battle.test.tsx` (add an assertion)

**Interfaces:** none new.

- [ ] **Step 1: Add a failing assertion**

In `tests/ui/battle.test.tsx`, add a test that the header no longer shows the action counter. Use the existing render setup in that file (find how it renders `BattleScreen` — reuse the same fixture/helper). Add:

```tsx
it('header has no action counter', () => {
  // (reuse the file's existing BattleScreen render helper/fixture)
  renderBattleScreen() // <- use whatever the file already uses to mount BattleScreen
  expect(screen.queryByText(/azione/i)).toBeNull()
})
```

If the file lacks a reusable helper, mirror the mounting code of an existing test in that file.

- [ ] **Step 2: Run, verify fail**

Run: `npm run test -- "tests/ui/battle"`
Expected: FAIL — header currently contains "azione".

- [ ] **Step 3: Remove the counter segment**

In `components/screens/BattleScreen.tsx`, change the header paragraph (lines 56-59) to drop the `· azione {r.index}/{r.total - 1}` part:

```tsx
        <p className="text-[11px] uppercase tracking-widest text-white/35">
          Turno {r.entry?.turn ?? 0}
          {r.entry?.actorId ? <> · agisce <span className="text-white/60">{replay.units.find(u => u.id === r.entry!.actorId && u.side === r.entry!.actorSide)?.name ?? r.entry!.actorId}</span></> : null}
        </p>
```

- [ ] **Step 4: Run, verify pass + typecheck**

Run: `npm run test -- "tests/ui/battle"` → PASS
Run: `npx tsc --noEmit` → 0 errors

- [ ] **Step 5: Commit**

```bash
git add components/screens/BattleScreen.tsx tests/ui/battle.test.tsx
git commit -m "feat(battle-ui): drop the action counter from the header"
```

---

## Task 2: Invert team rows (my team on top)

**Files:**
- Modify: `components/battle/BattleArena.tsx` (the return JSX row order)
- Test: `tests/ui/battleLayout.test.tsx` (flip the order assertion)

**Interfaces:** none new. `row-player` and `row-enemies` testids keep their meaning; only DOM order swaps (player first).

- [ ] **Step 1: Flip the failing test**

In `tests/ui/battleLayout.test.tsx`, the existing test asserts `row-enemies` precedes `row-player`. Change it to assert the player row now comes FIRST:

```tsx
it('player row sits above the enemy row in the DOM', () => {
  render(<BattleArena replay={replay} hp={{ 'left:a': 100, 'right:b': 100 }} entry={null} />)
  const player = screen.getByTestId('row-player')
  const enemies = screen.getByTestId('row-enemies')
  expect(player.compareDocumentPosition(enemies) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})
```

- [ ] **Step 2: Run, verify fail**

Run: `npm run test -- "battleLayout"`
Expected: FAIL — enemies still first.

- [ ] **Step 3: Swap the rows in BattleArena**

In `components/battle/BattleArena.tsx`, the return currently renders the enemy section, then the center divider, then the player section. Swap so the **player (`left`) section is first (top)** and the **enemy (`right`) section is last (bottom)**, keeping the center slot between them. The current structure is:

```tsx
      <section ...>
        <h3 ...>{rightTitle}</h3>
        <div data-testid="row-enemies" ...>{renderSide(right, true)}</div>
      </section>
      <div ...> {center ?? VS} </div>
      <section ...>
        <div data-testid="row-player" ...>{renderSide(left, false)}</div>
        <h3 ...>{leftTitle}</h3>
      </section>
```

Replace with (player on top, its title above the row; enemy on bottom, title below the row):

```tsx
      <section className="flex flex-col items-center gap-2 w-full">
        <h3 className="text-xs uppercase tracking-widest text-white/40">{leftTitle}</h3>
        <div data-testid="row-player" className="flex flex-nowrap justify-center gap-2 sm:gap-3">{renderSide(left, false)}</div>
      </section>

      <div className="self-center min-h-[1.5rem] w-full flex items-center justify-center">
        {center ?? <span className="font-display text-2xl text-white/30 select-none">VS</span>}
      </div>

      <section className="flex flex-col items-center gap-2 w-full">
        <div data-testid="row-enemies" className="flex flex-nowrap justify-center gap-2 sm:gap-3">{renderSide(right, true)}</div>
        <h3 className="text-xs uppercase tracking-widest text-white/40">{rightTitle}</h3>
      </section>
```

Keep `leftTitle` defaulting to "La tua squadra" and `rightTitle` to "Avversari" (existing prop defaults). Do not touch `renderSide`, `arenaRef`, the `useLayoutEffect`, or `SpellFx`.

- [ ] **Step 4: Run, verify pass + battle suite**

Run: `npm run test -- "battleLayout"` → PASS
Run: `npm run test -- "tests/ui/battle"` → green (if a test asserted enemy-on-top, flip it consistently and keep it meaningful)
Run: `npx tsc --noEmit` → 0 errors

- [ ] **Step 5: Commit**

```bash
git add components/battle/BattleArena.tsx tests/ui/battleLayout.test.tsx tests/ui/battle.test.tsx
git commit -m "feat(battle-ui): put the player team on top, enemies on the bottom"
```

---

## Task 3: Control overlay shows remaining turns

**Files:**
- Modify: `components/battle/UnitBust.tsx` (the control-overlay IIFE)
- Test: `tests/ui/unitBustControl.test.tsx` (add a turns assertion)

**Interfaces:** none new. The overlay badge text becomes `"<label> ·<n>t"` where `n = ctrl.remaining`.

- [ ] **Step 1: Add a failing assertion**

In `tests/ui/unitBustControl.test.tsx`, extend the freeze test (or add one) to assert the turn count shows:

```tsx
it('control overlay shows remaining turns', () => {
  const eff = { kind: 'freeze', statusId: 'freeze', remaining: 2 } as unknown as ActiveEffect
  const { container } = render(<UnitBust unit={unit} hp={100} effects={[eff]} />)
  const overlay = container.querySelector('[data-control="freeze"]')!
  expect(overlay.textContent).toMatch(/2t/)
})
```

- [ ] **Step 2: Run, verify fail**

Run: `npm run test -- unitBustControl`
Expected: FAIL — overlay shows only the label.

- [ ] **Step 3: Add the turn count to the overlay badge**

In `components/battle/UnitBust.tsx`, in the control-overlay IIFE (the block rendering `data-control`), change the badge span to include the remaining turns from `ctrl`:

```tsx
            <span className="rounded bg-black/65 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
              {o.label} ·{ctrl.remaining}t
            </span>
```

(`ctrl` is the matched `ActiveEffect`; `ctrl.remaining` already exists.)

- [ ] **Step 4: Run, verify pass + suites**

Run: `npm run test -- unitBustControl` → PASS
Run: `npm run test -- "tests/ui/battle"` and `npm run test -- unitBust` → green
Run: `npx tsc --noEmit` → 0 errors

- [ ] **Step 5: Commit**

```bash
git add components/battle/UnitBust.tsx tests/ui/unitBustControl.test.tsx
git commit -m "feat(battle-ui): control overlay shows remaining turns (·2t)"
```

---

## Task 4: `StatBar` + expanded stats in the bust

**Files:**
- Create: `components/battle/StatBar.tsx`
- Modify: `components/battle/UnitBust.tsx` (replace the single stat row with three StatBars)
- Test: `tests/ui/statBar.test.tsx` (create)

**Interfaces:**
- Produces: `StatBar({ label, value, base, color, icon })` where `label: string`, `value: number` (current/buffed), `base: number`, `color: string` (tailwind bg class for the fill), `icon: LucideIcon`. Fill % = `min(100, value / 60 * 100)`. Renders `data-stat={label}` and `data-buff={'up'|'down'|'none'}` (value vs base).

- [ ] **Step 1: Write the failing test**

Create `tests/ui/statBar.test.tsx`:

```tsx
import { it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Sword } from 'lucide-react'
import { StatBar } from '@/components/battle/StatBar'

it('clamps fill to 100% and marks buff direction', () => {
  const { container } = render(<StatBar label="ATT" value={90} base={40} color="bg-rose-400" icon={Sword} />)
  const el = container.querySelector('[data-stat="ATT"]')!
  expect(el.getAttribute('data-buff')).toBe('up')          // 90 > 40
  const fill = el.querySelector('[data-role="fill"]') as HTMLElement
  expect(fill.style.width).toBe('100%')                     // 90/60 clamped
})

it('marks debuff when value below base', () => {
  const { container } = render(<StatBar label="VEL" value={20} base={30} color="bg-amber-400" icon={Sword} />)
  expect(container.querySelector('[data-stat="VEL"]')!.getAttribute('data-buff')).toBe('down')
})
```

- [ ] **Step 2: Run, verify fail**

Run: `npm run test -- statBar`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement StatBar**

Create `components/battle/StatBar.tsx`:

```tsx
'use client'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/theme'

const STAT_REF = 60 // reference max for the bar fill

/** One labeled stat with a proportional fill bar, tinted by buff direction. */
export function StatBar({
  label, value, base, color, icon: Icon,
}: {
  label: string
  value: number
  base: number
  color: string
  icon: LucideIcon
}) {
  const buff = value > base ? 'up' : value < base ? 'down' : 'none'
  const pct = Math.min(100, (value / STAT_REF) * 100)
  const valueColor = buff === 'up' ? 'text-emerald-300' : buff === 'down' ? 'text-rose-300' : 'text-white/85'
  return (
    <div data-stat={label} data-buff={buff} className="flex items-center gap-1 w-full">
      <Icon size={11} aria-hidden className="shrink-0 text-white/50" />
      <span className="w-7 shrink-0 text-[9px] uppercase tracking-wide text-white/40">{label}</span>
      <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
        <span data-role="fill" className={cn('absolute inset-y-0 left-0 rounded-full', color)} style={{ width: `${pct}%` }} />
      </span>
      <span className={cn('w-6 shrink-0 text-right text-[11px] font-semibold tabular-nums', valueColor)}>{value}</span>
      {buff !== 'none' && <span aria-hidden className={cn('text-[8px]', valueColor)}>{buff === 'up' ? '▲' : '▼'}</span>}
    </div>
  )
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npm run test -- statBar` → PASS

- [ ] **Step 5: Use StatBars in UnitBust**

In `components/battle/UnitBust.tsx`, import StatBar and the stat icons (Sword, Shield, Zap are already imported). Replace the existing single stat row (the `<div className="mt-0.5 flex items-center justify-center gap-1 text-[11px] tabular-nums">…three `<Stat …/>`…</div>`) with a stacked StatBar group:

```tsx
      <div className="mt-1 flex flex-col gap-0.5">
        <StatBar label="ATT" value={unit.atk} base={unit.baseAtk} color="bg-rose-400" icon={Sword} />
        <StatBar label="DIF" value={unit.def} base={unit.baseDef} color="bg-sky-400" icon={Shield} />
        <StatBar label="VEL" value={unit.spd} base={unit.baseSpd} color="bg-amber-400" icon={Zap} />
      </div>
```

Then DELETE the now-unused local `Stat` sub-component and the `BUFF_CLASS`/`buffState` helpers IF they are no longer referenced anywhere else in the file (grep within the file first; if still used by something, leave them). Add `import { StatBar } from './StatBar'`.

- [ ] **Step 6: Run bust + battle suites**

Run: `npm run test -- unitBust` and `npm run test -- "tests/ui/battle"` and `npm run test -- unitBustStats`
Expected: green. If `unitBustStats.test.tsx` asserted the old `data-stat="atk"` inline format or `data-buff` on the old `Stat`, update it to the new StatBar output (`data-stat="ATT"/"DIF"/"VEL"`, `data-buff` on the StatBar). Keep assertions meaningful (they should still verify the value + buff direction render).

- [ ] **Step 7: Typecheck + commit**

```bash
npx tsc --noEmit
git add components/battle/StatBar.tsx components/battle/UnitBust.tsx tests/ui/statBar.test.tsx tests/ui/unitBustStats.test.tsx
git commit -m "feat(battle-ui): expanded bust stats as labeled bars (ATT/DIF/VEL)"
```

---

## Task 5: Vertical initiative bar with faces + side identity

**Files:**
- Modify: `components/battle/InitiativeBar.tsx` (full rewrite of the render)
- Test: `tests/ui/initiativeBar.test.tsx` (create or extend if present)

**Interfaces:** none new. Consumes the same `replay` + `index`. Uses `PortraitImage` (`@/components/ui/PortraitImage`) for faces; `ReplayUnit.side` for the mine/enemy indicator.

- [ ] **Step 1: Write the failing test**

Create `tests/ui/initiativeBar.test.tsx` (if one exists, add these cases):

```tsx
import { it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { InitiativeBar } from '@/components/battle/InitiativeBar'
import type { Replay } from '@/game/engine/combat/replay'

const replay = {
  units: [
    { key: 'left:a', id: 'a', name: 'Aaa', side: 'left', house: 'Grifondoro', role: 'Tank', tier: 3, maxHp: 100, atk: 10, def: 10, spd: 30, baseAtk: 10, baseDef: 10, baseSpd: 30, spell: { id: 's', name: 'S', cooldown: 0 } },
    { key: 'right:b', id: 'b', name: 'Bbb', side: 'right', house: 'Serpeverde', role: 'Attaccante', tier: 3, maxHp: 100, atk: 10, def: 10, spd: 20, baseAtk: 10, baseDef: 10, baseSpd: 20, spell: { id: 's', name: 'S', cooldown: 0 } },
  ],
  frames: [{ index: 0, entry: null, hp: { 'left:a': 100, 'right:b': 100 }, cooldowns: {}, statusEffects: {} }],
} as unknown as Replay

it('marks each slot with its side (mine vs enemy)', () => {
  const { container } = render(<InitiativeBar replay={replay} index={0} />)
  expect(container.querySelector('[data-side="left"]')).toBeTruthy()
  expect(container.querySelector('[data-side="right"]')).toBeTruthy()
})

it('renders a face image per unit', () => {
  const { container } = render(<InitiativeBar replay={replay} index={0} />)
  // PortraitImage renders an <img data-variant="bust"> (jsdom won't fire onError, so the img stays).
  expect(container.querySelectorAll('img[data-variant="bust"]').length).toBeGreaterThanOrEqual(2)
})
```

- [ ] **Step 2: Run, verify fail**

Run: `npm run test -- initiativeBar`
Expected: FAIL — no `data-side`; crests not images.

- [ ] **Step 3: Rewrite InitiativeBar render**

Replace the render in `components/battle/InitiativeBar.tsx`. Keep the imports for `motion`, `Zap`, `lastRealActorAt`, `houseTheme`/`cn`; ADD `import { PortraitImage } from '@/components/ui/PortraitImage'`. Keep the `sequence`/`byKey` derivation exactly. Replace the returned JSX:

```tsx
  return (
    <div
      data-testid="initiative-bar"
      className="flex flex-col items-stretch gap-1.5 w-20 max-h-[34rem] overflow-y-auto py-2"
    >
      <span className="text-[10px] uppercase tracking-widest text-white/35 text-center">Ordine</span>
      {sequence.map((key, i) => {
        const u = byKey[key]
        if (!u) return null
        const isCurrent = key === current
        const mine = u.side === 'left'
        const ring = mine ? 'ring-emerald-400/70' : 'ring-rose-400/70'
        return (
          <motion.div
            key={`${key}-${i}`}
            data-current={isCurrent || undefined}
            data-side={u.side}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: isCurrent ? 1 : 0.6, scale: isCurrent ? 1.05 : 1 }}
            transition={{ type: 'spring', stiffness: 320, damping: 24 }}
            className="relative flex items-center gap-1.5 rounded-lg px-1 py-0.5"
          >
            <div className={cn('relative h-9 w-9 shrink-0 overflow-hidden rounded-full ring-2', ring, isCurrent && 'ring-4')}>
              <PortraitImage id={u.id} house={u.house} alt={u.name} variant="bust" />
            </div>
            <div className="min-w-0 flex-1 leading-none">
              <div className="flex items-center gap-1">
                <span aria-hidden className={cn('text-[8px]', mine ? 'text-emerald-300' : 'text-rose-300')}>{mine ? '▲' : '▼'}</span>
                <span className="truncate text-[10px] text-white/85">{u.name}</span>
              </div>
              <span className="mt-0.5 flex items-center gap-0.5 text-[9px] tabular-nums text-white/55">
                <Zap className="h-2.5 w-2.5 text-amber-300/80" aria-hidden />{u.spd}
              </span>
            </div>
            {isCurrent && (
              <span data-role="ora-label" className="absolute -top-1 right-1 rounded bg-white/15 px-1 text-[7px] uppercase tracking-widest text-white/80">Ora</span>
            )}
          </motion.div>
        )
      })}
    </div>
  )
```

(If a prior test asserted the old horizontal `data-testid="initiative-bar"` had `overflow-x-auto` or a crest, it will need updating in Step 4.)

- [ ] **Step 4: Run, verify pass + suites**

Run: `npm run test -- initiativeBar` → PASS
Run: `npm run test -- "tests/ui/battle"` → green; update any initiative assertion that pinned the old crest/horizontal layout to the new face/side output, keeping it meaningful.
Run: `npx tsc --noEmit` → 0 errors

- [ ] **Step 5: Commit**

```bash
git add components/battle/InitiativeBar.tsx tests/ui/initiativeBar.test.tsx tests/ui/battle.test.tsx
git commit -m "feat(battle-ui): vertical initiative rail with faces + mine/enemy identity"
```

---

## Task 6: Labeled mine/enemy synergy ribbons

**Files:**
- Modify: `components/battle/SynergyRibbon.tsx` (add `title` + `tone`)
- Test: `tests/ui/synergyRibbon.test.tsx` (extend)

**Interfaces:**
- Produces: `SynergyRibbon` gains `title?: string` and `tone?: 'ally' | 'enemy'` (default `'ally'`). Renders the title as a header and an accent color by tone (ally green/gold, enemy red). Relics still only render when passed (player only).

- [ ] **Step 1: Write the failing test**

In `tests/ui/synergyRibbon.test.tsx`, add:

```tsx
it('renders a title and an enemy tone accent', () => {
  render(<SynergyRibbon synergies={[{ synergy: { id: 'x', name: 'Test', kind: 'house', requires: {}, bonus: {} }, memberIds: [] }] as any} title="Sinergie nemiche" tone="enemy" />)
  expect(screen.getByText('Sinergie nemiche')).toBeInTheDocument()
  expect(screen.getByTestId('synergy-ribbon').getAttribute('data-tone')).toBe('enemy')
})
```

(Reuse the file's existing synergy fixture shape if it has one.)

- [ ] **Step 2: Run, verify fail**

Run: `npm run test -- synergyRibbon`
Expected: FAIL — no title/tone.

- [ ] **Step 3: Add title + tone**

In `components/battle/SynergyRibbon.tsx`, extend the props and wrap with a titled, tone-accented container. Replace the component:

```tsx
export function SynergyRibbon({
  synergies, relics = [], align = 'left', title, tone = 'ally',
}: {
  synergies: ActiveSynergy[]
  relics?: ActiveRelic[]
  align?: 'left' | 'right'
  title?: string
  tone?: 'ally' | 'enemy'
}) {
  if (synergies.length === 0 && relics.length === 0 && !title) return null
  const accent = tone === 'enemy' ? 'border-rose-400/40 text-rose-200/80' : 'border-emerald-400/40 text-emerald-200/80'
  return (
    <div
      data-testid="synergy-ribbon"
      data-tone={tone}
      className={cn('flex flex-col gap-1 rounded-lg border px-2 py-1.5', accent, align === 'right' ? 'items-end' : 'items-start')}
    >
      {title && <span className="text-[9px] uppercase tracking-widest opacity-80">{title}</span>}
      <div className={cn('flex flex-wrap items-center gap-1', align === 'right' ? 'justify-end' : 'justify-start')}>
        {synergies.map((s) => (
          <span
            key={s.synergy.id}
            data-synergy={s.synergy.id}
            className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold"
            style={{ color: '#f3e6c4', borderColor: 'rgba(202,162,74,0.6)', background: 'rgba(176,141,87,0.16)' }}
          >
            <span aria-hidden style={{ color: '#caa24a' }}>✦</span>
            {s.synergy.name}
            <span className="text-[#c9bfa0]">{synergyBonusText(s.synergy.bonus).join(' · ')}</span>
          </span>
        ))}
        {relics.map((r) => (
          <span
            key={r.relic.id}
            data-relic={r.relic.id}
            className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold"
            style={{ color: '#d6c8ff', borderColor: 'rgba(124,58,237,0.5)', background: 'rgba(124,58,237,0.16)' }}
          >
            <span aria-hidden style={{ color: '#a855f7' }}>◈</span>
            {r.relic.name}
          </span>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run, verify pass + suite**

Run: `npm run test -- synergyRibbon` → PASS
Run: `npm run test -- "tests/ui/battle"` → green (the BattleScreen wiring in Task 8 passes the titles; existing ribbon-render tests should still pass since title is optional). If an existing test asserted the ribbon was a bare flex without the wrapper, update it.
Run: `npx tsc --noEmit` → 0 errors

- [ ] **Step 5: Commit**

```bash
git add components/battle/SynergyRibbon.tsx tests/ui/synergyRibbon.test.tsx
git commit -m "feat(battle-ui): titled mine/enemy synergy ribbons with tone accent"
```

---

## Task 7: ArenaBackdrop + richer impacts/auras (spectacle)

**Files:**
- Create: `components/battle/ArenaBackdrop.tsx`
- Modify: `components/battle/BattleArena.tsx` (mount backdrop behind the rows)
- Modify: `components/battle/UnitBust.tsx` (impact flash/shake on the targeted unit; crit jolt)
- Test: `tests/ui/arenaBackdrop.test.tsx` (create); extend `tests/ui/unitBustControl.test.tsx` or a new `tests/ui/unitBustImpact.test.tsx`.

**Interfaces:**
- Produces: `<ArenaBackdrop />` — an `aria-hidden`, `pointer-events-none`, absolutely-positioned decorative layer with `data-testid="arena-backdrop"`. UnitBust uses its existing `targeted`/`float`/`entry`-derived props; add an impact pulse when `targeted` and a stronger one when the float tone is `crit`.

- [ ] **Step 1: Write the failing tests**

Create `tests/ui/arenaBackdrop.test.tsx`:

```tsx
import { it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { ArenaBackdrop } from '@/components/battle/ArenaBackdrop'

it('renders an aria-hidden decorative layer', () => {
  const { container } = render(<ArenaBackdrop />)
  const el = container.querySelector('[data-testid="arena-backdrop"]')!
  expect(el).toBeTruthy()
  expect(el.getAttribute('aria-hidden')).toBe('true')
})
```

Create `tests/ui/unitBustImpact.test.tsx`:

```tsx
import { it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { UnitBust } from '@/components/battle/UnitBust'
import type { ReplayUnit } from '@/types'

const unit = {
  key: 'left:x', id: 'x', name: 'X', side: 'left', house: 'Grifondoro', role: 'Tank', tier: 3,
  maxHp: 100, atk: 10, def: 10, spd: 10, baseAtk: 10, baseDef: 10, baseSpd: 10,
  spell: { id: 's', name: 'S', cooldown: 0 },
} as unknown as ReplayUnit

it('shows an impact pulse when targeted', () => {
  const { container } = render(<UnitBust unit={unit} hp={70} targeted float={{ text: '30', tone: 'damage' }} floatKey={1} />)
  expect(container.querySelector('[data-impact]')).toBeTruthy()
})
it('shows no impact pulse when not targeted', () => {
  const { container } = render(<UnitBust unit={unit} hp={100} />)
  expect(container.querySelector('[data-impact]')).toBeNull()
})
```

- [ ] **Step 2: Run, verify fail**

Run: `npm run test -- arenaBackdrop` and `npm run test -- unitBustImpact`
Expected: FAIL — component missing; no `data-impact`.

- [ ] **Step 3: Implement ArenaBackdrop**

Create `components/battle/ArenaBackdrop.tsx`:

```tsx
'use client'
import { motion, useReducedMotion } from 'framer-motion'

/**
 * Decorative, non-interactive arena backdrop: a slow drifting magical glow.
 * Transform/opacity only; static under reduced motion. Sits behind the busts.
 */
export function ArenaBackdrop() {
  const reduce = useReducedMotion()
  return (
    <div
      data-testid="arena-backdrop"
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-3xl"
    >
      <motion.div
        className="absolute inset-0 opacity-40"
        style={{ background: 'radial-gradient(60% 50% at 50% 30%, rgba(124,58,237,0.18), transparent 70%), radial-gradient(50% 50% at 50% 80%, rgba(176,141,87,0.14), transparent 70%)' }}
        animate={reduce ? {} : { opacity: [0.3, 0.5, 0.3], scale: [1, 1.04, 1] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  )
}
```

- [ ] **Step 4: Mount the backdrop in BattleArena**

In `components/battle/BattleArena.tsx`, add `import { ArenaBackdrop } from './ArenaBackdrop'`, and render it as the FIRST child inside the `arenaRef` container (so it sits behind via `-z-10`):

```tsx
    <div ref={arenaRef} data-testid="battle-arena" className="relative flex flex-col items-center gap-4 w-full">
      <ArenaBackdrop />
      ...existing sections...
```

(Confirm the container is `relative` — it is.)

- [ ] **Step 5: Add impact pulse/shake to UnitBust**

In `components/battle/UnitBust.tsx`, derive an impact when the unit is `targeted` and has a `float`. Add inside the component, before the return, computing crit:

```tsx
  const impact = targeted && !!float
  const isCrit = float?.tone === 'crit'
```

Add to the root `motion.div`'s `animate` (merge with the existing scale/x animate object) a shake when impacted, reduced-motion-safe — change the existing `animate={reduce ? {} : {...}}` to include a small keyframe jitter when `impact`:

```tsx
      animate={reduce ? {} : {
        scale: acting ? 1.04 : 1,
        x: impact ? (isCrit ? [0, -6, 6, -3, 0] : [0, -3, 3, 0]) : (targeted ? (mirrored ? -4 : 4) : 0),
      }}
```

And render an impact flash overlay over the portrait (add just after the control-overlay IIFE), keyed on `floatKey` so it re-triggers each hit:

```tsx
      {impact && !reduce && (
        <motion.div
          key={`impact-${floatKey}`}
          data-impact={isCrit ? 'crit' : 'hit'}
          aria-hidden
          className={cn('pointer-events-none absolute inset-x-0 top-0 z-20 rounded-xl aspect-[3/4]', isCrit ? 'bg-amber-300/40' : 'bg-rose-400/30')}
          initial={{ opacity: 0.8 }}
          animate={{ opacity: 0 }}
          transition={{ duration: isCrit ? 0.5 : 0.32, ease: 'easeOut' }}
        />
      )}
```

NOTE: the test renders without reduced-motion, so `data-impact` is present. Under reduced-motion the flash is skipped (static), satisfying the constraint. To keep the "not targeted → no impact" test green, the block is gated on `impact`.

- [ ] **Step 6: Run, verify pass**

Run: `npm run test -- arenaBackdrop` and `npm run test -- unitBustImpact` → PASS
Run: `npm run test -- "tests/ui/battle"` and `npm run test -- unitBust` and `npm run test -- unitBustControl` → green
Run: `npx tsc --noEmit` → 0 errors

- [ ] **Step 7: Commit**

```bash
git add components/battle/ArenaBackdrop.tsx components/battle/BattleArena.tsx components/battle/UnitBust.tsx tests/ui/arenaBackdrop.test.tsx tests/ui/unitBustImpact.test.tsx
git commit -m "feat(battle-ui): animated arena backdrop + hit/crit impact pulses"
```

---

## Task 8: BattleScreen 3-column layout + side legend + labeled ribbons

**Files:**
- Modify: `components/battle/StatusLegend.tsx` (side-friendly variant)
- Modify: `components/screens/BattleScreen.tsx` (3-col grid; labeled ribbons; legend on the side)
- Test: `tests/ui/statusLegend.test.tsx` (keep); `tests/ui/battle.test.tsx` (assert both labeled ribbons + legend present)

**Interfaces:**
- Consumes: `InitiativeBar` (vertical now), `StatusLegend`, `SynergyRibbon` (title/tone), `BattleArena` (inverted), `ArenaBackdrop` (already inside arena).
- Produces: BattleScreen body is a responsive grid: on `lg`, `[initiative | arena+controls | legend]`; below `lg` it stacks (initiative and legend move below). Two labeled ribbons: player ("Le tue sinergie", tone ally, with relics) and enemy ("Sinergie nemiche", tone enemy).

- [ ] **Step 1: Add failing assertions**

In `tests/ui/battle.test.tsx`, add (reuse the file's BattleScreen render helper):

```tsx
it('shows separate labeled mine/enemy synergy ribbons', () => {
  renderBattleScreen() // file's existing helper
  expect(screen.getByText(/Le tue sinergie/i)).toBeInTheDocument()
  expect(screen.getByText(/Sinergie nemiche/i)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run, verify fail**

Run: `npm run test -- "tests/ui/battle"`
Expected: FAIL — titles not rendered yet.

- [ ] **Step 3: Make StatusLegend side-friendly**

In `components/battle/StatusLegend.tsx`, allow a single-column side layout. Change the open list to a single column and let the container be full-height friendly. Replace the `<ul …grid grid-cols-2…>` with a single column when rendered in the side (simplest: always single column — it reads fine in the side and still works below on mobile). Change:

```tsx
      {open && (
        <ul className="mt-2 flex flex-col gap-1 text-[11px]">
```

(Leave the rest as-is. The `defaultOpen` prop stays; BattleScreen will pass `defaultOpen` on desktop.)

- [ ] **Step 4: Rewrite BattleScreen layout**

In `components/screens/BattleScreen.tsx`, replace the JSX from the `<InitiativeBar … />` line through the `<BattleArena … />` block with a 3-column grid. Keep the header (now counter-free from Task 1), the controls block, and the recap/log below. New structure:

```tsx
      <div className="grid w-full max-w-5xl grid-cols-1 lg:grid-cols-[5rem_1fr_12rem] gap-4 items-start">
        <div className="hidden lg:block">
          <InitiativeBar replay={replay} index={r.index} />
        </div>

        <div className="flex flex-col items-center gap-3 min-w-0">
          <div className="flex w-full items-start justify-between gap-3">
            <SynergyRibbon synergies={playerSyn} relics={playerRelics ?? []} align="left" title="Le tue sinergie" tone="ally" />
            <SynergyRibbon synergies={enemySyn} align="right" title="Sinergie nemiche" tone="enemy" />
          </div>
          <BattleArena
            replay={replay} hp={r.hp} entry={r.entry} frameKey={r.index} rightTitle={rightTitle}
            center={<ActionPanel entry={stickyEntry} units={replay.units} />}
          />
        </div>

        <div className="hidden lg:block">
          <StatusLegend defaultOpen />
        </div>
      </div>

      {/* below-lg: initiative + legend stack here so small screens still get them */}
      <div className="flex flex-col items-center gap-3 lg:hidden w-full">
        <InitiativeBar replay={replay} index={r.index} />
        <StatusLegend />
      </div>
```

Remove the OLD standalone `<InitiativeBar … />` (line 62), the OLD ribbon row (lines 64-67), and the OLD standalone `<StatusLegend />` (line 101) — they're now inside the grid / the below-lg block. Keep the controls block and the `<BattleRecap … />` + `<BattleLog … />` lines as they are (below the grid).

- [ ] **Step 5: Run, verify pass + full battle suite**

Run: `npm run test -- "tests/ui/battle"` → PASS (both ribbon titles present)
Run: `npm run test -- statusLegend` and `npm run test -- battleLayout` → green
Note: InitiativeBar renders twice (desktop hidden + mobile hidden via CSS) — both are in the DOM in jsdom. If a test does `getByTestId('initiative-bar')` and now finds TWO, switch it to `getAllByTestId('initiative-bar')[0]` or scope it. Fix any such test meaningfully.

- [ ] **Step 6: Full suite + typecheck + build**

Run: `npm run test` → all green except known flakes (confirm isolated).
Run: `npx tsc --noEmit` → 0 errors.
Run: `npm run build` → succeeds.

- [ ] **Step 7: Commit**

```bash
git add components/battle/StatusLegend.tsx components/screens/BattleScreen.tsx tests/ui/battle.test.tsx
git commit -m "feat(battle-ui): 3-column battle layout — side initiative + side legend + labeled ribbons"
```

---

## Task 9: Final verification + build + push

**Files:** none (verification only).

- [ ] **Step 1: Full suite** — `npm run test` → all green (any red is a known flake passing in isolation).
- [ ] **Step 2: Typecheck** — `npx tsc --noEmit` → 0 errors.
- [ ] **Step 3: Build** — `npm run build` → succeeds.
- [ ] **Step 4: Confirm HEAD then push**

```bash
git rev-parse HEAD
git log --oneline -10
git push origin master
```

(Verify HEAD is this session's work before pushing — concurrent writer possible.)

---

## Self-Review notes

- **Spec coverage:** Part 1 invert → Task 2; Part 2 stat bars → Task 4; Part 3 side legend → Task 8 (+ StatusLegend variant); Part 4 control turns → Task 3; Part 5 mine/enemy ribbons → Task 6 (component) + Task 8 (wiring with titles); Part 6/7 vertical initiative + faces + side → Task 5; Part 8 remove counter → Task 1; Part 9 spectacle → Task 7. All covered.
- **Type consistency:** `StatBar` props (Task 4) consumed in UnitBust (Task 4). `SynergyRibbon` `title`/`tone` (Task 6) consumed in BattleScreen (Task 8). `ArenaBackdrop` (Task 7) mounted in BattleArena (Task 7). InitiativeBar signature unchanged (Task 5). All `data-*` test hooks (`data-stat`, `data-buff`, `data-side`, `data-tone`, `data-impact`, `data-control`, `arena-backdrop`) are introduced and asserted within the same task.
- **Ordering:** Counter removal (1) and invert (2) are independent and first. Stat bars (4) before the big BattleScreen rewrite (8). Spectacle (7) before (8) so the grid wraps a finished arena. Task 8 integrates everything and is last before final verify.
- **Double-mount note:** Task 8 renders InitiativeBar/StatusLegend twice (desktop + mobile via `hidden`/`lg:hidden`); flagged so tests using `getByTestId` switch to `getAllByTestId`.
- **No engine/data edits** in any task — components only.
