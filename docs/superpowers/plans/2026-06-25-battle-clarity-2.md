# Battle Clarity II Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Five battle-screen UX upgrades — centered action panel, larger busts, per-archetype spell animations (incl. a heal animation), clear control-effect overlays + log + legend, and a live damage/heal recap panel.

**Architecture:** Pure presentation. The recap is derived from the existing replay log (no engine change); animations read the existing `spellArchetype` data; control overlays read the frame's `statusEffects`. The action panel moves into a new `center` slot on `BattleArena`.

**Tech Stack:** Next.js (custom fork — read `node_modules/next/dist/docs/` before any Next-specific code), React, TypeScript, framer-motion, lucide-react, Tailwind, Vitest + Testing Library.

## Global Constraints

- Test runner: `npm run test` (Vitest). **Vitest does NOT typecheck** — after editing any `.ts`/`.tsx`, also run `npx tsc --noEmit` and confirm 0 errors.
- All user-facing copy is **Italian** (match existing strings).
- **No engine or data changes.** `game/engine/**` and `data/**` are off-limits. Everything is `components/**`, `lib/**`, `hooks/**`, `tests/**`.
- Deterministic: no `Math.random`/`Date.now`.
- Animations must be transform/opacity-only where possible (mobile-cheap) and degrade to a static final state under `useReducedMotion()`.
- Known flaky tests: `tests/ui/playFlow.test.tsx` and `tests/ui/campaignRunner.test.tsx` are parallel-timeout flakes that PASS in isolation (`npx vitest run <file>`). If one is the only red, confirm isolated, then it's fine. Any OTHER red is real.
- Commit after every task. Work on `master`; verify `git rev-parse HEAD` before committing (concurrent writer possible). Push only at the final task.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `lib/battleRecap.ts` | `recapTotals` pure helper — per-unit damage/heal from log | Create |
| `components/battle/BattleRecap.tsx` | live recap panel (player team ranking) | Create |
| `components/battle/StatusLegend.tsx` | status legend (icon + name + effect) | Create |
| `components/battle/BattleArena.tsx` | `center` prop in divider slot; control overlays on busts | Modify |
| `components/battle/UnitBust.tsx` | larger size; control overlay | Modify |
| `components/battle/SpellFx.tsx` | shape-specific anims + heal sparkle | Modify |
| `components/battle/BattleLog.tsx` | explicit freeze/silence/disarm copy | Modify |
| `components/screens/BattleScreen.tsx` | action panel as center; render legend + recap | Modify |

---

## Task 1: `recapTotals` pure helper

**Files:**
- Create: `lib/battleRecap.ts`
- Test: `tests/battleRecap.test.ts` (create)

**Interfaces:**
- Consumes: `ReplayFrame` (`{ index, entry, hp, cooldowns, statusEffects }`) and `ReplayUnit` (`{ key, id, name, side, ... }`) from `@/game/engine/combat/replay`; `unitKey(side, id)` from the same module. `LogEntry` has `{ actorId, actorSide, targetId, targetSide, value?, flags[] }`.
- Produces: `recapTotals(frames: ReplayFrame[], units: ReplayUnit[], side: 'left'|'right'): RecapRow[]` where `RecapRow = { key: string; name: string; dealt: number; healed: number }`, one row per unit on `side`, sorted by `(dealt + healed)` descending then by `name` for stability.

- [ ] **Step 1: Write the failing test**

Create `tests/battleRecap.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { recapTotals } from '@/lib/battleRecap'
import type { ReplayFrame, ReplayUnit } from '@/game/engine/combat/replay'
import type { LogEntry } from '@/types'

const units = [
  { key: 'left:a', id: 'a', name: 'Aaa', side: 'left' },
  { key: 'left:b', id: 'b', name: 'Bbb', side: 'left' },
  { key: 'right:x', id: 'x', name: 'Xxx', side: 'right' },
] as unknown as ReplayUnit[]

function frame(entry: LogEntry | null): ReplayFrame {
  return { index: 0, entry, hp: {}, cooldowns: {}, statusEffects: {} } as unknown as ReplayFrame
}
function dmg(actorId: string, actorSide: 'left'|'right', targetId: string, targetSide: 'left'|'right', value: number, flags: string[] = []): LogEntry {
  return { turn: 1, actorId, actorSide, targetId, targetSide, action: 'S', type: 'Attacco', value, flags } as unknown as LogEntry
}

describe('recapTotals', () => {
  it('attributes damage to the actor and ignores the initial null frame', () => {
    const frames = [frame(null), frame(dmg('a','left','x','right',30))]
    const rows = recapTotals(frames, units, 'left')
    expect(rows.find(r => r.key === 'left:a')!.dealt).toBe(30)
    expect(rows.find(r => r.key === 'left:b')!.dealt).toBe(0)
  })

  it('attributes healing via the heal flag', () => {
    const heal = { turn: 1, actorId: 'a', actorSide: 'left', targetId: 'b', targetSide: 'left', action: 'Episkey', type: 'Cura', value: 20, flags: ['heal'] } as unknown as LogEntry
    const rows = recapTotals([frame(null), frame(heal)], units, 'left')
    expect(rows.find(r => r.key === 'left:a')!.healed).toBe(20)
    expect(rows.find(r => r.key === 'left:a')!.dealt).toBe(0)
  })

  it('excludes DoT self-ticks (actor === target) from dealt', () => {
    const dot = { turn: 2, actorId: 'a', actorSide: 'left', targetId: 'a', targetSide: 'left', action: 'Veleno', type: 'Controllo', value: 8, flags: ['dot'] } as unknown as LogEntry
    const rows = recapTotals([frame(null), frame(dot)], units, 'left')
    expect(rows.find(r => r.key === 'left:a')!.dealt).toBe(0)
  })

  it('sorts by dealt+healed descending', () => {
    const frames = [frame(null), frame(dmg('b','left','x','right',50)), frame(dmg('a','left','x','right',10))]
    const rows = recapTotals(frames, units, 'left')
    expect(rows[0]!.key).toBe('left:b')
    expect(rows[1]!.key).toBe('left:a')
  })

  it('only includes the requested side', () => {
    const rows = recapTotals([frame(null)], units, 'left')
    expect(rows.map(r => r.key).sort()).toEqual(['left:a','left:b'])
  })
})
```

- [ ] **Step 2: Run test, verify fail**

Run: `npm run test -- battleRecap`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `lib/battleRecap.ts`:

```ts
import type { ReplayFrame, ReplayUnit } from '@/game/engine/combat/replay'
import { unitKey } from '@/game/engine/combat/replay'

export interface RecapRow {
  key: string
  name: string
  dealt: number
  healed: number
}

/**
 * Per-unit damage dealt and healing done, derived from the replay log up to the
 * frames passed in (pass a slice for live/partial totals). Heal is credited via
 * the 'heal' flag; damage is any positive value that is NOT a heal and NOT a
 * DoT self-tick (actor === target). Returns one row per unit on `side`, sorted
 * by dealt+healed descending, then name.
 */
export function recapTotals(
  frames: ReplayFrame[], units: ReplayUnit[], side: 'left' | 'right',
): RecapRow[] {
  const rows = new Map<string, RecapRow>()
  for (const u of units) {
    if (u.side === side) rows.set(u.key, { key: u.key, name: u.name, dealt: 0, healed: 0 })
  }
  for (const f of frames) {
    const e = f.entry
    if (!e || !e.actorSide || e.actorSide !== side) continue
    const row = rows.get(unitKey(e.actorSide, e.actorId))
    if (!row) continue
    const value = e.value ?? 0
    if (value <= 0) continue
    if (e.flags.includes('heal')) { row.healed += value; continue }
    // DoT self-tick: a poisoned unit logged as its own actor/target — not "damage dealt".
    if (e.actorId === e.targetId && e.actorSide === e.targetSide) continue
    row.dealt += value
  }
  return [...rows.values()].sort((a, b) => (b.dealt + b.healed) - (a.dealt + a.healed) || a.name.localeCompare(b.name))
}
```

- [ ] **Step 4: Run test, verify pass**

Run: `npm run test -- battleRecap`
Expected: PASS (5/5).

- [ ] **Step 5: Typecheck + commit**

```bash
npx tsc --noEmit
git add lib/battleRecap.ts tests/battleRecap.test.ts
git commit -m "feat(battle): recapTotals helper — per-unit damage/heal from replay log"
```

---

## Task 2: `BattleRecap` live panel

**Files:**
- Create: `components/battle/BattleRecap.tsx`
- Test: `tests/ui/battleRecap.test.tsx` (create)

**Interfaces:**
- Consumes: `recapTotals` (Task 1), `ReplayFrame`/`ReplayUnit` from `@/game/engine/combat/replay`.
- Produces: `<BattleRecap frames={ReplayFrame[]} units={ReplayUnit[]} side="left" />` (default side `'left'`). Renders one row per player unit, sorted, with a damage bar + heal bar. Container has `data-testid="battle-recap"`; each row `data-recap-row` with the unit name; top row is the implicit MVP.

- [ ] **Step 1: Write the failing test**

Create `tests/ui/battleRecap.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BattleRecap } from '@/components/battle/BattleRecap'
import type { ReplayFrame, ReplayUnit } from '@/game/engine/combat/replay'
import type { LogEntry } from '@/types'

const units = [
  { key: 'left:a', id: 'a', name: 'Aaa', side: 'left' },
  { key: 'left:b', id: 'b', name: 'Bbb', side: 'left' },
] as unknown as ReplayUnit[]
const f = (e: LogEntry | null) => ({ index: 0, entry: e, hp: {}, cooldowns: {}, statusEffects: {} } as unknown as ReplayFrame)
const dmg = (id: string, v: number) => ({ turn: 1, actorId: id, actorSide: 'left', targetId: 'x', targetSide: 'right', action: 'S', type: 'Attacco', value: v, flags: [] } as unknown as LogEntry)

it('renders player rows sorted with the top dealer first', () => {
  render(<BattleRecap frames={[f(null), f(dmg('b', 40)), f(dmg('a', 10))]} units={units} />)
  expect(screen.getByTestId('battle-recap')).toBeInTheDocument()
  const rows = screen.getAllByTestId('battle-recap-row')
  expect(rows[0]).toHaveTextContent('Bbb')
  expect(rows[1]).toHaveTextContent('Aaa')
})
```

- [ ] **Step 2: Run, verify fail**

Run: `npm run test -- "tests/ui/battleRecap"`
Expected: FAIL — component missing.

- [ ] **Step 3: Implement**

Create `components/battle/BattleRecap.tsx`:

```tsx
'use client'
import type { ReplayFrame, ReplayUnit } from '@/game/engine/combat/replay'
import { recapTotals } from '@/lib/battleRecap'

/**
 * Live damage/heal recap for one team. Bars are scaled to the team's current
 * max combined total so the leader's bar is full and the rest are relative.
 * Pass a sliced `frames` for the running (partial) totals during replay.
 */
export function BattleRecap({
  frames, units, side = 'left',
}: {
  frames: ReplayFrame[]
  units: ReplayUnit[]
  side?: 'left' | 'right'
}) {
  const rows = recapTotals(frames, units, side)
  const max = Math.max(1, ...rows.map(r => r.dealt + r.healed))

  return (
    <div data-testid="battle-recap" className="glass rounded-2xl p-3 w-full max-w-md">
      <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-white/50">Resoconto squadra</p>
      <ul className="space-y-1.5">
        {rows.map((r) => (
          <li key={r.key} data-testid="battle-recap-row" className="flex items-center gap-2 text-[11px]">
            <span className="w-20 truncate text-white/80">{r.name}</span>
            <span className="flex-1 flex h-2 overflow-hidden rounded-full bg-white/10">
              <span className="h-full bg-rose-400/80" style={{ width: `${(r.dealt / max) * 100}%` }} />
              <span className="h-full bg-emerald-400/80" style={{ width: `${(r.healed / max) * 100}%` }} />
            </span>
            <span className="w-16 text-right tabular-nums text-white/55">
              <span className="text-rose-300">{r.dealt}</span>
              {r.healed > 0 && <span className="text-emerald-300"> +{r.healed}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npm run test -- "tests/ui/battleRecap"`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

```bash
npx tsc --noEmit
git add components/battle/BattleRecap.tsx tests/ui/battleRecap.test.tsx
git commit -m "feat(battle-ui): live damage/heal recap panel"
```

---

## Task 3: Per-archetype spell animations + heal sparkle

**Files:**
- Modify: `components/battle/SpellFx.tsx`
- Test: `tests/ui/spellFx.test.tsx` (create; if one exists, extend it)

**Interfaces:**
- Consumes: `archetypeFor(entry)`, `archetypeStyle(a)` (has `{ color, trail, shape }`, `shape ∈ 'bolt'|'orb'|'wave'|'burst'`) from `@/lib/spellArchetype`; `FxPoint` from this file.
- Produces: `SpellFx` renders a shape-specific effect carrying `data-archetype` and a NEW `data-shape` attribute. For `heal` it renders a target-anchored sparkle (`data-shape="heal"`, no caster→target flight). `shield`/`none` still render nothing.

- [ ] **Step 1: Write the failing test**

Create `tests/ui/spellFx.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { SpellFx } from '@/components/battle/SpellFx'
import type { LogEntry } from '@/types'

const at = { x: 50, y: 80 }
const from = { x: 50, y: 20 }
function entry(partial: Partial<LogEntry>): LogEntry {
  return { turn: 1, actorId: 'a', actorSide: 'left', targetId: 'x', targetSide: 'right', action: 'S', type: 'Attacco', flags: [], ...partial } as LogEntry
}

it('fire renders a burst shape', () => {
  const { container } = render(<SpellFx entry={entry({ action: 'Incendio', type: 'Attacco' })} from={from} to={at} fxKey={1} />)
  expect(container.querySelector('[data-archetype="fire"][data-shape="burst"]')).toBeTruthy()
})

it('heal renders a target-anchored sparkle and no projectile flight', () => {
  const { container } = render(<SpellFx entry={entry({ action: 'Episkey', type: 'Cura', flags: ['heal'] })} from={from} to={at} fxKey={2} />)
  expect(container.querySelector('[data-shape="heal"]')).toBeTruthy()
})

it('shield still renders nothing', () => {
  const { container } = render(<SpellFx entry={entry({ action: 'Protego', type: 'Difesa', flags: ['block'] })} from={from} to={at} fxKey={3} />)
  expect(container.querySelector('[data-testid="spell-fx"]')).toBeNull()
})
```

- [ ] **Step 2: Run, verify fail**

Run: `npm run test -- "tests/ui/spellFx"`
Expected: FAIL — no `data-shape`; heal currently returns null (no sparkle).

- [ ] **Step 3: Rewrite SpellFx render**

Replace the body of `SpellFx` (the part after computing `archetype`/`style`) in `components/battle/SpellFx.tsx`. Keep the early returns for `none`/`shield`. CHANGE: heal must NOT early-return; it renders the sparkle. New structure:

```tsx
export function SpellFx({
  entry, from, to, fxKey,
}: { entry: LogEntry | null; from?: FxPoint | null; to?: FxPoint | null; fxKey: number | string }) {
  const reduce = useReducedMotion()
  const archetype = archetypeFor(entry)
  if (archetype === 'none' || archetype === 'shield') return null
  const style = archetypeStyle(archetype)

  // Heal: a target-anchored rising sparkle, no caster→target flight.
  if (archetype === 'heal') {
    if (!to) return null
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <motion.span
          key={fxKey}
          data-testid="spell-fx"
          data-archetype="heal"
          data-shape="heal"
          initial={reduce ? { opacity: 1 } : { opacity: 0, scale: 0.6 }}
          animate={reduce ? { opacity: 1 } : { opacity: [0, 1, 0], y: [-0, -18, -30], scale: [0.6, 1, 0.9] }}
          transition={{ duration: reduce ? 0 : 0.7, ease: 'easeOut' }}
          className="absolute h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            left: `${to.x}%`, top: `${to.y}%`,
            background: `radial-gradient(circle, ${style.color} 0%, ${style.trail} 60%, transparent 100%)`,
            boxShadow: `0 0 18px ${style.trail}`,
          }}
        />
      </div>
    )
  }

  // Projectiles need both endpoints.
  if (!from || !to) return null
  const fromX = `${from.x}%`, fromY = `${from.y}%`
  const toX = `${to.x}%`, toY = `${to.y}%`

  // Per-shape silhouette. burst scales up on impact; orb is round + pulsing; bolt is a streak.
  const shapeClass =
    style.shape === 'orb' ? 'h-5 w-5 rounded-full'
    : style.shape === 'burst' ? 'h-6 w-6 rounded-full'
    : 'h-2.5 w-9 rounded-full' // bolt / wave fallback
  const impactScale = style.shape === 'burst' ? [0.6, 1, 1.8] : style.shape === 'orb' ? [0.6, 1.1, 1] : [0.6, 1, 1]

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <AnimatePresence>
        <motion.span
          key={fxKey}
          data-testid="spell-fx"
          data-archetype={archetype}
          data-shape={style.shape}
          initial={reduce ? { opacity: 1, left: toX, top: toY } : { opacity: 0.2, left: fromX, top: fromY, scale: 0.6 }}
          animate={{ opacity: reduce ? 1 : [0.4, 1, style.shape === 'burst' ? 0 : 1], left: toX, top: toY, scale: reduce ? 1 : impactScale }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.46, ease: 'easeIn' }}
          className={`absolute -translate-x-1/2 -translate-y-1/2 ${shapeClass}`}
          style={{
            background: `radial-gradient(circle, ${style.color} 0%, ${style.trail} 70%, transparent 100%)`,
            boxShadow: `0 0 16px ${style.trail}`,
          }}
        />
      </AnimatePresence>
    </div>
  )
}
```

Keep `ShieldFx` exactly as it is (do not edit it).

- [ ] **Step 4: Run, verify pass**

Run: `npm run test -- "tests/ui/spellFx"`
Expected: PASS (3/3).

- [ ] **Step 5: Full battle tests still pass**

Run: `npm run test -- "tests/ui/battle"`
If a test asserted the old fixed `h-3 w-8` projectile class, update it to the new shape-based assertion (`data-shape`), keeping it meaningful.

- [ ] **Step 6: Typecheck + commit**

```bash
npx tsc --noEmit
git add components/battle/SpellFx.tsx tests/ui/spellFx.test.tsx tests/ui/battle.test.tsx
git commit -m "feat(battle-ui): per-archetype spell shapes + target-anchored heal sparkle"
```

---

## Task 4: Control-effect overlay on busts

**Files:**
- Modify: `components/battle/UnitBust.tsx`
- Test: `tests/ui/unitBustControl.test.tsx` (create)

**Interfaces:**
- Consumes: `UnitBust`'s existing `effects?: ActiveEffect[]` prop (already passed by `BattleArena`). `ActiveEffect.kind ∈ 'stun'|'freeze'|'silence'|'disarm'|...`.
- Produces: when `effects` contains a control kind (stun/freeze/silence/disarm), `UnitBust` renders a full-bust overlay tinted per kind with `data-control="<kind>"`. Existing corner pills are unchanged.

- [ ] **Step 1: Write the failing test**

Create `tests/ui/unitBustControl.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { UnitBust } from '@/components/battle/UnitBust'
import type { ReplayUnit, ActiveEffect } from '@/types'

const unit = {
  key: 'left:x', id: 'x', name: 'X', side: 'left', house: 'Grifondoro', role: 'Tank', tier: 3,
  maxHp: 100, atk: 10, def: 10, spd: 10, baseAtk: 10, baseDef: 10, baseSpd: 10,
  spell: { id: 's', name: 'S', cooldown: 0 },
} as unknown as ReplayUnit

it('renders a freeze overlay when frozen', () => {
  const eff = { kind: 'freeze', statusId: 'freeze', remaining: 2 } as unknown as ActiveEffect
  const { container } = render(<UnitBust unit={unit} hp={100} effects={[eff]} />)
  expect(container.querySelector('[data-control="freeze"]')).toBeTruthy()
})

it('renders no control overlay when only a buff is active', () => {
  const eff = { kind: 'buff', statusId: 'atkUp', remaining: 2, stat: 'atk', amount: 20 } as unknown as ActiveEffect
  const { container } = render(<UnitBust unit={unit} hp={100} effects={[eff]} />)
  expect(container.querySelector('[data-control]')).toBeNull()
})
```

- [ ] **Step 2: Run, verify fail**

Run: `npm run test -- unitBustControl`
Expected: FAIL — no `data-control` overlay.

- [ ] **Step 3: Implement the overlay**

In `components/battle/UnitBust.tsx`, add a control-kind map near the other maps:

```tsx
/** Control kinds get a full-bust overlay so a skipped/limited turn reads instantly. */
const CONTROL_OVERLAY: Record<string, { label: string; cls: string }> = {
  stun:    { label: 'Stordito',  cls: 'bg-yellow-300/25 ring-2 ring-yellow-300/60' },
  freeze:  { label: 'Congelato', cls: 'bg-cyan-300/25 ring-2 ring-cyan-300/60' },
  silence: { label: 'Silenziato',cls: 'bg-violet-300/20 ring-2 ring-violet-300/50' },
  disarm:  { label: 'Disarmato', cls: 'bg-amber-300/20 ring-2 ring-amber-300/50' },
}
```

Inside the component, compute the active control (first matching effect) and render an overlay over the portrait. Add this just AFTER the portrait/RarityFrame block (the `</RarityFrame>` close), before the name line:

```tsx
      {(() => {
        const ctrl = effects.find(e => CONTROL_OVERLAY[e.kind])
        if (!ctrl) return null
        const o = CONTROL_OVERLAY[ctrl.kind]!
        return (
          <div
            data-control={ctrl.kind}
            className={cn('pointer-events-none absolute inset-x-0 top-0 z-10 grid place-items-center rounded-xl aspect-[3/4]', o.cls)}
          >
            <span className="rounded bg-black/65 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
              {o.label}
            </span>
          </div>
        )
      })()}
```

Note: the overlay box mirrors the portrait's `aspect-[3/4]` so it covers the face area, not the stat rows below. Confirm the bust root is `relative` (it is — `motion.div` has `className="relative ..."`).

- [ ] **Step 4: Run, verify pass**

Run: `npm run test -- unitBustControl`
Expected: PASS.

- [ ] **Step 5: Battle suite + typecheck**

Run: `npm run test -- "tests/ui/battle"` then `npm run test -- unitBust`
Expected: green (the overlay is additive; existing pill tests unaffected).
Run: `npx tsc --noEmit` → 0 errors.

- [ ] **Step 6: Commit**

```bash
git add components/battle/UnitBust.tsx tests/ui/unitBustControl.test.tsx
git commit -m "feat(battle-ui): full-bust control overlay (stun/freeze/silence/disarm)"
```

---

## Task 5: Explicit control log copy

**Files:**
- Modify: `components/battle/BattleLog.tsx:33-53` (`describeEntry`) and the call site at `:82`
- Test: `tests/ui/battleLogControl.test.tsx` (create)

**Interfaces:**
- Consumes: `LogEntry`, `names`. The engine logs every skipped action as `entry.action === 'Stordito'` regardless of the true cause (stun OR freeze both `prevents:['action']`), so `describeEntry` cannot know freeze-vs-stun from the entry alone.
- Produces: `describeEntry(entry, names, controlKind?)` — optional 3rd arg `controlKind?: 'stun'|'freeze'|'silence'|'disarm'`. When `entry.action === 'Stordito'` and `controlKind` is given, the copy reflects the precise status. `BattleLog` passes the unit's active control kind for that frame.

- [ ] **Step 1: Write the failing test**

Create `tests/ui/battleLogControl.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { describeEntry } from '@/components/battle/BattleLog'
import type { LogEntry } from '@/types'

const names = { 'left:a': 'Aaa' }
const skip = { turn: 3, actorId: 'a', actorSide: 'left', action: 'Stordito', type: 'system', flags: [] } as unknown as LogEntry

it('defaults to stun copy', () => {
  expect(describeEntry(skip, names)).toMatch(/stordito e salta il turno/)
})
it('uses freeze copy when controlKind is freeze', () => {
  expect(describeEntry(skip, names, 'freeze')).toMatch(/congelato e salta il turno/)
})
it('uses silence copy when controlKind is silence', () => {
  expect(describeEntry(skip, names, 'silence')).toMatch(/silenziato/)
})
```

- [ ] **Step 2: Run, verify fail**

Run: `npm run test -- battleLogControl`
Expected: FAIL — `describeEntry` takes 2 args; no freeze/silence branch.

- [ ] **Step 3: Extend describeEntry**

In `components/battle/BattleLog.tsx`, change the signature and the `'Stordito'` branch:

```ts
export function describeEntry(
  entry: LogEntry, names: Record<string, string>,
  controlKind?: 'stun' | 'freeze' | 'silence' | 'disarm',
): string {
```

Replace the line `if (entry.action === 'Stordito') return ...` with:

```ts
  if (entry.action === 'Stordito') {
    const who = actor
    switch (controlKind) {
      case 'freeze':  return `${who} è congelato e salta il turno`
      case 'silence': return `${who} è silenziato: niente incantesimi`
      case 'disarm':  return `${who} è disarmato: niente attacchi`
      default:        return `${who} è stordito e salta il turno`
    }
  }
```

- [ ] **Step 4: Thread the control kind from BattleLog's render**

`BattleLog` receives `entries: LogEntry[]` but not per-frame statuses. The simplest correct source: derive the control kind from the entry's own actor status is not available here. Instead, accept an optional resolver prop and default to undefined (keeping current behavior for callers that don't pass it):

Change `BattleLog`'s props to add `controlAt?: (entry: LogEntry) => 'stun'|'freeze'|'silence'|'disarm'|undefined` and use it in the map:

```tsx
export function BattleLog({
  entries, units, max = 7, controlAt,
}: {
  entries: LogEntry[]
  units: ReplayUnit[]
  max?: number
  controlAt?: (entry: LogEntry) => 'stun' | 'freeze' | 'silence' | 'disarm' | undefined
}) {
```

and at the call to describeEntry (line ~82):

```tsx
                {describeEntry(entry, names, controlAt?.(entry))}
```

(Task 6 supplies `controlAt` from the replay frames in BattleScreen. Without it, copy stays the existing stun default — safe.)

- [ ] **Step 5: Run, verify pass + typecheck**

Run: `npm run test -- battleLogControl` → PASS
Run: `npm run test -- "tests/ui/battleLog"` (if present) → green; update any existing call that now needs the unchanged 2-arg form (it still works — 3rd arg optional).
Run: `npx tsc --noEmit` → 0 errors.

- [ ] **Step 6: Commit**

```bash
git add components/battle/BattleLog.tsx tests/ui/battleLogControl.test.tsx
git commit -m "feat(battle-ui): explicit freeze/silence/disarm log copy"
```

---

## Task 6: StatusLegend + BattleArena `center` slot + BattleScreen wiring

**Files:**
- Create: `components/battle/StatusLegend.tsx`
- Modify: `components/battle/BattleArena.tsx` (add `center` prop in the divider slot)
- Modify: `components/screens/BattleScreen.tsx` (action panel as center; render legend + recap; supply `controlAt`)
- Test: `tests/ui/statusLegend.test.tsx` (create); extend `tests/ui/battleLayout.test.tsx` for the center slot.

**Interfaces:**
- Consumes: `STATUS_DEFS`/`STATUS_BY_ID` from `@/data/statuses` (read-only, for names); `BattleRecap` (Task 2); `recapTotals` not needed here; `ActionPanel`; `ReplayFrame.statusEffects` keyed by unitKey.
- Produces: `<StatusLegend />` (collapsible, `data-testid="status-legend"`). `BattleArena` gains `center?: React.ReactNode` rendered between the rows (fallback "VS"). `BattleScreen` renders ActionPanel as `center`, removes the bottom ActionPanel, and renders `StatusLegend` + `BattleRecap`.

- [ ] **Step 1: Write the failing tests**

Create `tests/ui/statusLegend.test.tsx`:

```tsx
import { it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusLegend } from '@/components/battle/StatusLegend'

it('lists control statuses with an effect blurb', () => {
  render(<StatusLegend defaultOpen />)
  expect(screen.getByTestId('status-legend')).toBeInTheDocument()
  expect(screen.getByText(/Stordito/)).toBeInTheDocument()
  expect(screen.getByText(/Congelamento/)).toBeInTheDocument()
})
```

Extend `tests/ui/battleLayout.test.tsx` with a center-slot case (append):

```tsx
it('renders the center node between the rows', () => {
  render(<BattleArena replay={replay} hp={{ 'left:a': 100, 'right:b': 100 }} entry={null} center={<div data-testid="center-slot">X</div>} />)
  expect(screen.getByTestId('center-slot')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run, verify fail**

Run: `npm run test -- "statusLegend"` and `npm run test -- "battleLayout"`
Expected: FAIL — component missing; `center` prop not supported.

- [ ] **Step 3: Implement StatusLegend**

Create `components/battle/StatusLegend.tsx`:

```tsx
'use client'
import { useState } from 'react'
import { Info } from 'lucide-react'

/** One-line Italian effect blurbs, keyed by the visible status name. */
const LEGEND: Array<{ name: string; effect: string }> = [
  { name: 'Stordito', effect: 'salta il turno (nessuna azione)' },
  { name: 'Congelamento', effect: 'salta il turno (nessuna azione)' },
  { name: 'Silenziato', effect: 'non può lanciare incantesimi' },
  { name: 'Disarmato', effect: 'non può attaccare' },
  { name: 'Bruciatura', effect: 'danno nel tempo ogni turno' },
  { name: 'Indebolimento', effect: 'attacco ridotto (%)' },
  { name: 'Vulnerabilità', effect: 'difesa ridotta (%)' },
  { name: 'Lentezza', effect: 'velocità ridotta (%)' },
  { name: 'Scudo', effect: 'assorbe danni' },
  { name: 'Rigenerazione', effect: 'recupera vita ogni turno' },
]

export function StatusLegend({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div data-testid="status-legend" className="w-full max-w-md">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-1 text-[11px] uppercase tracking-widest text-white/50 hover:text-white/80"
      >
        <Info size={13} aria-hidden /> Legenda stati
      </button>
      {open && (
        <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
          {LEGEND.map((s) => (
            <li key={s.name} className="flex justify-between gap-2">
              <span className="font-semibold text-white/80">{s.name}</span>
              <span className="text-white/45 text-right">{s.effect}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Add `center` to BattleArena**

In `components/battle/BattleArena.tsx`, add `center?: React.ReactNode` to the props type, and replace the divider div:

```tsx
      <div className="self-center min-h-[1.5rem] w-full flex items-center justify-center">
        {center ?? <span className="font-display text-2xl text-white/30 select-none">VS</span>}
      </div>
```

Add `center` to the destructured props. Import React's type if needed (`import type { ReactNode } from 'react'`). Make sure this div is the one between `row-enemies` and `row-player`.

- [ ] **Step 5: Wire BattleScreen**

In `components/screens/BattleScreen.tsx`:
1. Build a `controlAt` resolver from the replay frames: for a given entry, find the frame whose entry is that entry, read its actor's `statusEffects`, return the first control kind. Add near the top of the component:

```tsx
  const controlAt = useMemo(() => {
    const kinds = ['stun', 'freeze', 'silence', 'disarm'] as const
    return (entry: LogEntry) => {
      const fi = replay.frames.findIndex(f => f.entry === entry)
      if (fi < 0 || !entry.actorSide) return undefined
      const key = `${entry.actorSide}:${entry.actorId}`
      const effs = replay.frames[fi]?.statusEffects?.[key] ?? []
      return kinds.find(k => effs.some(e => e.kind === k))
    }
  }, [replay])
```

(Import `LogEntry` from `@/types` if not already imported.)

2. Pass ActionPanel as the arena `center`, remove the standalone ActionPanel line:

```tsx
      <BattleArena
        replay={replay} hp={r.hp} entry={r.entry} frameKey={r.index} rightTitle={rightTitle}
        center={<ActionPanel entry={stickyEntry} units={replay.units} />}
      />
```

(Delete the old `<ActionPanel entry={stickyEntry} units={replay.units} />` line that was below the arena.)

3. After the controls block, render the recap + legend (import them):

```tsx
import { BattleRecap } from '@/components/battle/BattleRecap'
import { StatusLegend } from '@/components/battle/StatusLegend'
```

and in JSX, replace the `BattleLog` line region with:

```tsx
      <StatusLegend />
      <BattleRecap frames={replay.frames.slice(0, r.index + 1)} units={replay.units} side="left" />
      <BattleLog
        entries={replay.frames.slice(1, r.index + 1).map(f => f.entry!)}
        units={replay.units}
        controlAt={controlAt}
      />
```

- [ ] **Step 6: Run the new tests + full battle suite**

Run: `npm run test -- "statusLegend"` → PASS
Run: `npm run test -- "battleLayout"` → PASS (incl. center-slot case)
Run: `npm run test -- "tests/ui/battle"` → green. If a battle test asserted the ActionPanel appears *below* the arena or counted a specific DOM order, update it: ActionPanel now lives inside the arena center. Keep assertions meaningful (assert the panel is within the arena, or simply that it renders).

- [ ] **Step 7: Full suite + typecheck**

Run: `npm run test` → all green except possibly the known playFlow/campaignRunner flakes (confirm isolated).
Run: `npx tsc --noEmit` → 0 errors.

- [ ] **Step 8: Commit**

```bash
git add components/battle/StatusLegend.tsx components/battle/BattleArena.tsx components/screens/BattleScreen.tsx tests/ui/statusLegend.test.tsx tests/ui/battleLayout.test.tsx tests/ui/battle.test.tsx
git commit -m "feat(battle-ui): centered action panel, status legend, live recap wiring"
```

---

## Task 7: Larger busts + info legibility

**Files:**
- Modify: `components/battle/UnitBust.tsx`
- Test: existing bust tests (assert content, not width) should stay green; no new test unless a width class is pinned.

**Interfaces:** none new — sizing/typography only.

- [ ] **Step 1: Enlarge the bust**

In `components/battle/UnitBust.tsx`, change the root width `w-28 sm:w-32` → `w-32 sm:w-36`. Bump cramped text one step where it aids legibility:
- name line `text-[11px]` → `text-xs`
- stat row `text-[10px]` → `text-[11px]`
- cooldown row `text-[10px]` → `text-[11px]`

Leave the portrait `aspect-[3/4]`, rarity frame, status pills, and the new control overlay box (which uses `aspect-[3/4]` to track the portrait) intact — confirm the overlay still covers the portrait at the new width (it scales with the box, so it does).

- [ ] **Step 2: Run battle + bust suites**

Run: `npm run test -- "tests/ui/battle"` and `npm run test -- unitBust`
Expected: green. If any test pins `w-28`/`w-32` exactly, update to the new class; otherwise no change.

- [ ] **Step 3: Typecheck + visual sanity (build)**

Run: `npx tsc --noEmit` → 0 errors.
Run: `npm run build` → succeeds.

- [ ] **Step 4: Commit**

```bash
git add components/battle/UnitBust.tsx tests/
git commit -m "feat(battle-ui): larger busts + clearer in-combat info typography"
```

---

## Task 8: Final verification + build + push

**Files:** none (verification only).

- [ ] **Step 1: Full suite**

Run: `npm run test` → all green (confirm any red is a known flake passing in isolation).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit` → 0 errors.

- [ ] **Step 3: Production build**

Run: `npm run build` → succeeds, all routes prerender.

- [ ] **Step 4: Confirm HEAD then push**

```bash
git rev-parse HEAD
git log --oneline -9
git push origin master
```

---

## Self-Review notes

- **Spec coverage:** Part 1 (center panel) → Task 6; Part 2 (larger busts) → Task 7; Part 3 (per-archetype anims + heal) → Task 3; Part 4 (control overlay/log/legend) → Tasks 4 (overlay), 5 (log), 6 (legend); Part 5 (live recap) → Tasks 1 (helper) + 2 (panel) + 6 (wiring). All covered.
- **Type consistency:** `recapTotals(frames, units, side)` defined in Task 1 is consumed identically in Tasks 2 and 6. `describeEntry`'s optional 3rd arg `controlKind` (Task 5) matches the `controlAt` resolver return type (Task 6). `center?: ReactNode` (Task 6) consumed by BattleScreen (Task 6). `data-shape` (Task 3) asserted in Task 3 tests.
- **Ordering:** Task 7 (resize) runs last among UI tasks so it doesn't churn the overlay box added in Task 4. Task 6 depends on Tasks 2+5 (recap + log resolver) — sequenced after them.
- **No engine/data edits** in any task — all changes are components/lib/tests.
- **Assumption verified at execution:** the divider div in BattleArena is the one between row-enemies and row-player (confirmed in current source); the bust root is `relative` (confirmed) so the overlay positions correctly.
