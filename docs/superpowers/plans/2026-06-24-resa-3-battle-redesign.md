# Battaglia animata "La Resa" — Implementation Plan (Plan 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the scrolling battle log into a staged, animated fight where the player can see who acts (by speed), what each spell does (motion vocabulary), and that Protego blocks — purely presentational, reading the existing deterministic replay.

**Architecture:** Split the monolithic `BattleScreen` along the boundaries from spec §9: a playback hook (`useBattlePlayback`, extending the existing `useBattleReplay` with single-step), pure mapping libs (`lib/spellArchetype.ts`, `lib/initiative.ts`), and presentation components (`InitiativeBar`, `BattleArena`, `UnitBust`, `SpellFx`, `ShieldFx`, `StatusIcons`, `ActionBanner`, `BattleControls`). The combat engine is **not touched** except a read-only `tier` field added to `ReplayUnit` so busts can render rarity frames. Same seed → same fight; animations never alter HP/outcome.

**Tech Stack:** Next.js (App Router) + React 19, TypeScript strict, Tailwind v4 (`@theme`), framer-motion ^12 (`motion`, `AnimatePresence`, `useReducedMotion`), Vitest + React Testing Library. Icons from `lucide-react`.

## Global Constraints

- **Mobile-first**, then desktop — every component readable at 390px width.
- **Deterministic**: animations are presentational only; identical replay/seed → identical fight. The existing replay/seed regression tests are the gate (`tests/engine/combat/replay.test.ts`, `tests/engine/replayRelics.test.ts`) and must stay green.
- **TypeScript strict** — no `any`, no non-null on possibly-absent data without a guard.
- **`prefers-reduced-motion`**: every animated component degrades to a static (instantly-final) state via framer-motion's `useReducedMotion`. CSS-driven animations gate on the existing `.resa-animated` rule in `app/globals.css:53`.
- **Italian UI copy** — all visible strings in Italian, matching existing screens ("La tua squadra", "Avversari", "Salta", "PARATO").
- **No new combat-engine concepts** — initiative order is *derived* from the already-ordered replay action sequence, not a new turn queue. Spell archetype is *derived* from `LogEntry` data (`type` + `flags` + `action`), not bespoke per spell.
- **Reuse Plan-1 primitives**: `PortraitImage` (`components/ui/PortraitImage.tsx`), `RarityFrame` (`components/ui/RarityFrame.tsx`), `HouseCrest` (`components/ui/HouseCrest.tsx`), `rarityStyle` (`lib/rarity.ts`), `houseTheme`/`cn` (`lib/theme.ts`).
- **Suite floor**: starts at 367 passing. Every task ends green; never regress.

### Reference: existing types (do not redefine)

```ts
// types/combat.ts
export type LogFlag = 'crit' | 'dodge' | 'kill' | 'heal' | 'block' | 'stun' | 'dot'
export interface LogEntry {
  turn: number
  actorId: string
  actorSide?: Side          // 'left' | 'right'
  action: string            // spell name, or 'KO' | 'Stordito' | 'Veleno'
  targetId?: string
  targetSide?: Side
  type: SpellType | 'system' // 'Attacco' | 'Difesa' | 'Cura' | 'Controllo' | 'system'
  value?: number
  flags: LogFlag[]
}

// game/engine/combat/replay.ts
export interface ReplayUnit {
  key: string; side: Side; id: string; name: string
  house: House; role: Role; maxHp: number
  // tier: Tier   ← ADDED in Task 1
}
export interface ReplayFrame { index: number; entry: LogEntry | null; hp: Record<string, number> }
export interface Replay { units: ReplayUnit[]; frames: ReplayFrame[]; winner: Side; mvpId: string; turns: number }
export function unitKey(side: Side, id: string): string  // `${side}:${id}`
```

`DraftedWizard` carries `tier: Tier` (1=Leggendario … 4=Comune) and `spell: Spell`. `buildReplay(result, left, right, opts)` maps `toBattleUnits(...)` → `units`. Each `BattleUnit` (from `simulate.ts`) exposes `.wizard` (a `DraftedWizard`).

---

## Task 1: Add read-only `tier` to ReplayUnit

The busts need rarity to render `RarityFrame`. `tier` lives on `DraftedWizard.wizard`; surface it on `ReplayUnit`. Pure read-through, no engine behavior change.

**Files:**
- Modify: `game/engine/combat/replay.ts` (interface `ReplayUnit` + the `units` map in `buildReplay`)
- Test: `tests/engine/combat/replay.test.ts`

**Interfaces:**
- Consumes: `DraftedWizard.tier` (existing), `toBattleUnits` output `u.wizard.tier`.
- Produces: `ReplayUnit.tier: Tier` — consumed by `UnitBust` (Task 6) and tests.

- [ ] **Step 1: Write the failing test**

Add to `tests/engine/combat/replay.test.ts`:

```ts
it('exposes each unit tier for rarity rendering', () => {
  const l = team(['harry', 'ron', 'hermione', 'luna', 'neville'], 7)
  const r = team(['draco', 'crabbe', 'goyle', 'snape', 'bellatrix'], 13)
  const replay = buildReplay(simulateBattle(l, r, createRng(42)), l, r)
  for (const u of replay.units) {
    expect([1, 2, 3, 4]).toContain(u.tier)
  }
})
```

(If `team`/imports are not already in this file, mirror the helpers from `tests/ui/battle.test.tsx`: `import { simulateBattle } from '@/game/engine/combat/simulate'`, `draftWizard`, `createRng`, `WIZARD_BY_ID`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/combat/replay.test.ts -t "tier"`
Expected: FAIL — `Property 'tier' does not exist on type 'ReplayUnit'` (type error) or `undefined` not in `[1,2,3,4]`.

- [ ] **Step 3: Add the field and map it**

In `game/engine/combat/replay.ts`, add `import type { Tier } from '@/types'` to the type import list (it re-exports from `types/wizard`). Then:

```ts
export interface ReplayUnit {
  key: string
  side: Side
  id: string
  name: string
  house: House
  role: Role
  tier: Tier
  maxHp: number
}
```

In `buildReplay`, the `units` map gains `tier`:

```ts
const units: ReplayUnit[] = [...L, ...R].map(u => ({
  key: unitKey(u.side, u.wizard.id),
  side: u.side,
  id: u.wizard.id,
  name: u.wizard.name,
  house: u.wizard.house,
  role: u.wizard.role,
  tier: u.wizard.tier,
  maxHp: u.maxHp,
}))
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/engine/combat/replay.test.ts`
Expected: PASS (all replay tests).

- [ ] **Step 5: Commit**

```bash
git add game/engine/combat/replay.ts tests/engine/combat/replay.test.ts
git commit -m "feat(battle): expose unit tier on ReplayUnit for rarity busts"
```

---

## Task 2: Spell archetype mapping (pure)

Map a `LogEntry` to a visual archetype that drives `SpellFx` motion + color. Derived only from existing data — `type`, `flags`, and the spell `action` name. No new engine concept.

**Files:**
- Create: `lib/spellArchetype.ts`
- Test: `tests/lib/spellArchetype.test.ts`

**Interfaces:**
- Consumes: `LogEntry` (`types/combat`).
- Produces:
  - `type SpellArchetype = 'beam' | 'curse' | 'fire' | 'dark' | 'shield' | 'heal' | 'stun' | 'disarm' | 'none'`
  - `interface ArchetypeStyle { archetype: SpellArchetype; color: string; trail: string; shape: 'bolt' | 'orb' | 'wave' | 'burst' }`
  - `function archetypeFor(entry: LogEntry | null): SpellArchetype`
  - `function archetypeStyle(a: SpellArchetype): ArchetypeStyle`
  - consumed by `SpellFx` (Task 7) and `ActionBanner` (Task 9).

- [ ] **Step 1: Write the failing test**

Create `tests/lib/spellArchetype.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { archetypeFor, archetypeStyle } from '@/lib/spellArchetype'
import type { LogEntry } from '@/types'

const base: LogEntry = { turn: 1, actorId: 'a', actorSide: 'left', action: 'X', type: 'Attacco', flags: [] }

describe('archetypeFor', () => {
  it('maps a heal flag to heal', () => {
    expect(archetypeFor({ ...base, type: 'Cura', flags: ['heal'] })).toBe('heal')
  })
  it('maps a stun flag to stun', () => {
    expect(archetypeFor({ ...base, flags: ['stun'] })).toBe('stun')
  })
  it('maps a Difesa / block to shield', () => {
    expect(archetypeFor({ ...base, type: 'Difesa', flags: [] })).toBe('shield')
    expect(archetypeFor({ ...base, type: 'Attacco', flags: ['block'] })).toBe('shield')
  })
  it('maps a dot flag to fire', () => {
    expect(archetypeFor({ ...base, flags: ['dot'] })).toBe('fire')
  })
  it('recognizes the killing curse by name as dark', () => {
    expect(archetypeFor({ ...base, action: 'Avada Kedavra' })).toBe('dark')
  })
  it('recognizes the disarm by name', () => {
    expect(archetypeFor({ ...base, action: 'Expelliarmus' })).toBe('disarm')
  })
  it('falls back to a straight beam for a plain attack', () => {
    expect(archetypeFor({ ...base, type: 'Attacco', flags: [] })).toBe('beam')
  })
  it('returns none for a system entry with no target', () => {
    expect(archetypeFor({ ...base, type: 'system', action: 'KO', flags: ['kill'] })).toBe('none')
  })
  it('returns none for null', () => {
    expect(archetypeFor(null)).toBe('none')
  })
})

describe('archetypeStyle', () => {
  it('gives every archetype a color and a shape', () => {
    for (const a of ['beam', 'curse', 'fire', 'dark', 'shield', 'heal', 'stun', 'disarm'] as const) {
      const s = archetypeStyle(a)
      expect(s.color).toMatch(/^#|rgb/)
      expect(['bolt', 'orb', 'wave', 'burst']).toContain(s.shape)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/spellArchetype.test.ts`
Expected: FAIL — `Cannot find module '@/lib/spellArchetype'`.

- [ ] **Step 3: Implement the mapping**

Create `lib/spellArchetype.ts`:

```ts
import type { LogEntry } from '@/types'

export type SpellArchetype =
  | 'beam' | 'curse' | 'fire' | 'dark' | 'shield' | 'heal' | 'stun' | 'disarm' | 'none'

export interface ArchetypeStyle {
  archetype: SpellArchetype
  /** Core color of the projectile/flash. */
  color: string
  /** Trailing glow color (rgba ok). */
  trail: string
  /** Motion silhouette the SpellFx renders. */
  shape: 'bolt' | 'orb' | 'wave' | 'burst'
}

/** Named spells whose identity overrides the generic type/flags mapping. */
const BY_NAME: Array<[RegExp, SpellArchetype]> = [
  [/avada|kedavra|crucio|sectumsempra|morsmordre/i, 'dark'],
  [/expelliarmus|disarm/i, 'disarm'],
  [/incendio|confringo|bombarda|fuoco|fiend/i, 'fire'],
  [/protego|scudo|difes/i, 'shield'],
]

/**
 * Maps a replay log entry to a visual archetype. Derived purely from the
 * entry's existing data (spell name, type, flags) — no engine concept added.
 * Precedence: explicit named spells → status flags → spell type → fallback.
 */
export function archetypeFor(entry: LogEntry | null): SpellArchetype {
  if (!entry) return 'none'

  // System narration (KO, etc.) and self-targetless effects have no projectile.
  if (entry.type === 'system' && entry.action === 'KO') return 'none'

  for (const [re, a] of BY_NAME) if (re.test(entry.action)) return a

  if (entry.flags.includes('heal') || entry.type === 'Cura') return 'heal'
  if (entry.type === 'Difesa' || entry.flags.includes('block')) return 'shield'
  if (entry.flags.includes('stun')) return 'stun'
  if (entry.flags.includes('dot')) return 'fire'

  if (entry.type === 'Controllo') return 'curse'
  if (entry.type === 'Attacco') return 'beam'
  return 'none'
}

const STYLES: Record<Exclude<SpellArchetype, 'none'>, ArchetypeStyle> = {
  beam:   { archetype: 'beam',   color: '#7CFC9B', trail: 'rgba(124,252,155,0.5)', shape: 'bolt' },
  curse:  { archetype: 'curse',  color: '#FF6B6B', trail: 'rgba(255,107,107,0.5)', shape: 'bolt' },
  fire:   { archetype: 'fire',   color: '#FF9D3C', trail: 'rgba(255,157,60,0.55)', shape: 'burst' },
  dark:   { archetype: 'dark',   color: '#a855f7', trail: 'rgba(168,85,247,0.55)', shape: 'orb' },
  shield: { archetype: 'shield', color: '#7dd3fc', trail: 'rgba(125,211,252,0.5)', shape: 'wave' },
  heal:   { archetype: 'heal',   color: '#7CFC9B', trail: 'rgba(124,252,155,0.5)', shape: 'orb' },
  stun:   { archetype: 'stun',   color: '#fde047', trail: 'rgba(253,224,71,0.6)',  shape: 'burst' },
  disarm: { archetype: 'disarm', color: '#caa24a', trail: 'rgba(202,162,74,0.5)',  shape: 'bolt' },
}

const NONE_STYLE: ArchetypeStyle = { archetype: 'none', color: '#ffffff', trail: 'rgba(255,255,255,0.3)', shape: 'bolt' }

export function archetypeStyle(a: SpellArchetype): ArchetypeStyle {
  return a === 'none' ? NONE_STYLE : STYLES[a]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/spellArchetype.test.ts`
Expected: PASS (all assertions).

- [ ] **Step 5: Commit**

```bash
git add lib/spellArchetype.ts tests/lib/spellArchetype.test.ts
git commit -m "feat(battle): pure spell→animation archetype mapping"
```

---

## Task 3: Initiative order from the replay (pure)

The initiative bar shows who acts now and who's queued, ordered by the engine's already-ordered action sequence. Pure derivation from frames — no speed field invented.

**Files:**
- Create: `lib/initiative.ts`
- Test: `tests/lib/initiative.test.ts`

**Interfaces:**
- Consumes: `Replay`, `ReplayUnit`, `unitKey` (`game/engine/combat/replay`).
- Produces:
  - `interface InitiativeSlot { key: string; turn: number }` (key = `unitKey`)
  - `function initiativeOrder(replay: Replay): InitiativeSlot[]` — the full sequence of actor slots, in action order, skipping `system` entries.
  - `function initiativeAt(replay: Replay, index: number): { current: string | null; upcoming: string[] }` — for the frame at `index` (1-based action index as used by `useBattleReplay`): `current` is the actor of frame `index`, `upcoming` the next distinct actor keys (max 5) after it.
  - consumed by `InitiativeBar` (Task 5).

- [ ] **Step 1: Write the failing test**

Create `tests/lib/initiative.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { initiativeOrder, initiativeAt } from '@/lib/initiative'
import { buildReplay, unitKey } from '@/game/engine/combat/replay'
import { simulateBattle } from '@/game/engine/combat/simulate'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARD_BY_ID } from '@/data/wizards'
import type { DraftedWizard } from '@/types'

function team(ids: string[], seed = 1): DraftedWizard[] {
  const r = createRng(seed)
  return ids.map(id => draftWizard(r, WIZARD_BY_ID[id]!))
}
const mk = () => {
  const l = team(['harry', 'ron', 'hermione', 'luna', 'neville'], 7)
  const r = team(['draco', 'crabbe', 'goyle', 'snape', 'bellatrix'], 13)
  return buildReplay(simulateBattle(l, r, createRng(42)), l, r)
}

describe('initiativeOrder', () => {
  it('lists one slot per non-system action, in log order', () => {
    const replay = mk()
    const order = initiativeOrder(replay)
    expect(order.length).toBeGreaterThan(0)
    // Every slot key belongs to a real unit.
    const keys = new Set(replay.units.map(u => u.key))
    for (const s of order) expect(keys.has(s.key)).toBe(true)
  })
  it('is a pure projection of the actor sequence (no system frames)', () => {
    const replay = mk()
    const acted = replay.frames
      .filter(f => f.entry && f.entry.type !== 'system' && f.entry.actorSide)
      .map(f => unitKey(f.entry!.actorSide!, f.entry!.actorId))
    expect(initiativeOrder(replay).map(s => s.key)).toEqual(acted)
  })
})

describe('initiativeAt', () => {
  it('returns the acting unit at a given action index', () => {
    const replay = mk()
    // First real action frame index.
    const firstReal = replay.frames.findIndex(f => f.entry && f.entry.type !== 'system' && f.entry.actorSide)
    const { current } = initiativeAt(replay, firstReal)
    const f = replay.frames[firstReal]!
    expect(current).toBe(unitKey(f.entry!.actorSide!, f.entry!.actorId))
  })
  it('returns null current and empty upcoming at the initial frame', () => {
    const replay = mk()
    expect(initiativeAt(replay, 0)).toEqual({ current: null, upcoming: [] })
  })
  it('caps upcoming at five distinct actors', () => {
    const replay = mk()
    const { upcoming } = initiativeAt(replay, 1)
    expect(upcoming.length).toBeLessThanOrEqual(5)
    expect(new Set(upcoming).size).toBe(upcoming.length)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/initiative.test.ts`
Expected: FAIL — `Cannot find module '@/lib/initiative'`.

- [ ] **Step 3: Implement**

Create `lib/initiative.ts`:

```ts
import type { Replay } from '@/game/engine/combat/replay'
import { unitKey } from '@/game/engine/combat/replay'

export interface InitiativeSlot {
  /** unitKey of the actor. */
  key: string
  turn: number
}

/**
 * The full ordered sequence of who acts, derived from the replay's already-
 * ordered frames. System frames (KO narration, poison ticks without an actor
 * side) are skipped — they aren't "someone taking their turn". This is a read-
 * only projection: no new turn-queue concept enters the combat engine.
 */
export function initiativeOrder(replay: Replay): InitiativeSlot[] {
  const out: InitiativeSlot[] = []
  for (const f of replay.frames) {
    const e = f.entry
    if (!e || e.type === 'system' || !e.actorSide) continue
    out.push({ key: unitKey(e.actorSide, e.actorId), turn: e.turn })
  }
  return out
}

/**
 * For the frame at `index` (the action index used by useBattleReplay, where 0
 * is the initial full-HP frame), returns the current actor and the next up-to-5
 * distinct upcoming actors. Frames whose entry is system/actorless contribute
 * no `current`.
 */
export function initiativeAt(
  replay: Replay,
  index: number,
): { current: string | null; upcoming: string[] } {
  const frame = replay.frames[index]
  const e = frame?.entry
  const current = e && e.type !== 'system' && e.actorSide ? unitKey(e.actorSide, e.actorId) : null

  const upcoming: string[] = []
  for (let i = index + 1; i < replay.frames.length && upcoming.length < 5; i++) {
    const fe = replay.frames[i]!.entry
    if (!fe || fe.type === 'system' || !fe.actorSide) continue
    const key = unitKey(fe.actorSide, fe.actorId)
    if (!upcoming.includes(key)) upcoming.push(key)
  }
  return { current, upcoming }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/initiative.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/initiative.ts tests/lib/initiative.test.ts
git commit -m "feat(battle): derive initiative order from replay sequence"
```

---

## Task 4: `useBattlePlayback` — add single-step to the playback hook

Extend the existing controller with step-by-step (advance exactly one action, pausing). The current `useBattleReplay` has play/pause/toggle/skip/setSpeed but no `step`. Add `step` and a `stepBack` (passo-passo both ways), keeping all existing behavior so `BattleScreen` (Task 10) and the existing hook test keep working.

**Files:**
- Modify: `hooks/useBattleReplay.ts`
- Test: `tests/ui/useBattleReplay.test.tsx`

**Interfaces:**
- Consumes: `Replay`.
- Produces: `BattleReplayController` gains `step: () => void` and `stepBack: () => void`. All existing fields unchanged.

- [ ] **Step 1: Write the failing test**

Add to `tests/ui/useBattleReplay.test.tsx`:

```ts
it('step advances exactly one action and pauses', () => {
  const { result } = renderHook(() => useBattleReplay(replay, { autoPlay: false }))
  expect(result.current.index).toBe(0)
  act(() => result.current.step())
  expect(result.current.index).toBe(1)
  expect(result.current.playing).toBe(false)
})

it('stepBack rewinds one action without going below zero', () => {
  const { result } = renderHook(() => useBattleReplay(replay, { autoPlay: false }))
  act(() => { result.current.step(); result.current.step() })
  expect(result.current.index).toBe(2)
  act(() => result.current.stepBack())
  expect(result.current.index).toBe(1)
  act(() => { result.current.stepBack(); result.current.stepBack() })
  expect(result.current.index).toBe(0)
})
```

(Reuse the existing `replay` fixture and imports already at the top of this file — `renderHook`, `act` from `@testing-library/react`, `useBattleReplay`. If `act`/`renderHook` aren't imported yet, add `import { renderHook, act } from '@testing-library/react'`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/useBattleReplay.test.tsx -t "step"`
Expected: FAIL — `result.current.step is not a function`.

- [ ] **Step 3: Implement step / stepBack**

In `hooks/useBattleReplay.ts`, add to the `BattleReplayController` interface:

```ts
  step: () => void
  stepBack: () => void
```

Inside the hook, after `skip`:

```ts
  const step = useCallback(() => {
    setPlaying(false)
    setIndex(i => Math.min(total - 1, i + 1))
  }, [total])
  const stepBack = useCallback(() => {
    setPlaying(false)
    setIndex(i => Math.max(0, i - 1))
  }, [])
```

Add `step` and `stepBack` to the returned object.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/useBattleReplay.test.tsx`
Expected: PASS (new + existing).

- [ ] **Step 5: Commit**

```bash
git add hooks/useBattleReplay.ts tests/ui/useBattleReplay.test.tsx
git commit -m "feat(battle): add step / stepBack to battle playback controller"
```

---

## Task 5: `InitiativeBar` component

Top rail of avatars in initiative order: who acts NOW (highlighted), then the queue. Reduced-motion safe (no looping animation needed; entrance only).

**Files:**
- Create: `components/battle/InitiativeBar.tsx`
- Test: `tests/ui/battle.test.tsx` (new `describe('InitiativeBar')`)

**Interfaces:**
- Consumes: `Replay`, `initiativeAt` (Task 3), `HouseCrest`/`PortraitImage` (Plan 1), `unitKey`.
- Produces: `function InitiativeBar({ replay, index }: { replay: Replay; index: number }): JSX.Element`. Renders a `data-testid="initiative-bar"` wrapper; the current actor's chip has `data-current`.

- [ ] **Step 1: Write the failing test**

Add to `tests/ui/battle.test.tsx`:

```ts
import { InitiativeBar } from '@/components/battle/InitiativeBar'

describe('InitiativeBar', () => {
  it('marks the unit acting at the current frame', () => {
    const l = left(), r = right()
    const replay = buildReplay(simulateBattle(l, r, createRng(42)), l, r)
    const firstReal = replay.frames.findIndex(
      f => f.entry && f.entry.type !== 'system' && f.entry.actorSide,
    )
    render(<InitiativeBar replay={replay} index={firstReal} />)
    const bar = screen.getByTestId('initiative-bar')
    expect(bar.querySelector('[data-current]')).not.toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/battle.test.tsx -t "InitiativeBar"`
Expected: FAIL — `Cannot find module '@/components/battle/InitiativeBar'`.

- [ ] **Step 3: Implement**

Create `components/battle/InitiativeBar.tsx`:

```tsx
'use client'
import { motion } from 'framer-motion'
import type { Replay } from '@/game/engine/combat/replay'
import { initiativeAt } from '@/lib/initiative'
import { HouseCrest } from '@/components/ui/HouseCrest'
import { houseTheme, cn } from '@/lib/theme'

/**
 * Speed-order rail: the unit acting now plus the upcoming queue, derived from
 * the replay action sequence. Makes "why the fast one strikes first" explicit.
 */
export function InitiativeBar({ replay, index }: { replay: Replay; index: number }) {
  const { current, upcoming } = initiativeAt(replay, index)
  const byKey = Object.fromEntries(replay.units.map(u => [u.key, u]))
  const sequence = [current, ...upcoming].filter((k): k is string => !!k)

  return (
    <div
      data-testid="initiative-bar"
      className="flex items-center gap-2 overflow-x-auto w-full max-w-lg px-1 py-2"
    >
      <span className="text-[10px] uppercase tracking-widest text-white/35 shrink-0">Turno</span>
      {sequence.map((key, i) => {
        const u = byKey[key]
        if (!u) return null
        const isCurrent = i === 0
        const theme = houseTheme(u.house)
        return (
          <motion.div
            key={`${key}-${i}`}
            data-current={isCurrent || undefined}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: isCurrent ? 1 : 0.55, scale: isCurrent ? 1 : 0.85 }}
            transition={{ type: 'spring', stiffness: 320, damping: 24 }}
            className={cn(
              'relative shrink-0 grid place-items-center rounded-full border',
              isCurrent ? 'h-11 w-11 border-white/70' : 'h-8 w-8 border-white/15',
            )}
            style={{ background: theme.gradient, boxShadow: isCurrent ? theme.ring : undefined }}
            title={u.name}
          >
            <HouseCrest house={u.house} size={isCurrent ? 18 : 14} />
          </motion.div>
        )
      })}
    </div>
  )
}
```

(If `HouseCrest`'s prop names differ from `{ house, size }`, read `components/ui/HouseCrest.tsx` and adapt the call — keep the same wrapper structure and `data-testid`/`data-current`.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/battle.test.tsx`
Expected: PASS (new InitiativeBar + existing).

- [ ] **Step 5: Commit**

```bash
git add components/battle/InitiativeBar.tsx tests/ui/battle.test.tsx
git commit -m "feat(battle): InitiativeBar showing speed-ordered turn queue"
```

---

## Task 6: `UnitBust` — portrait + rarity frame + status + HP

The richer combatant tile that replaces `BattleUnit` in the new arena: rarity frame (Plan 1), face-cropped portrait, house crest, HP bar, status icons, acting/targeted aura. Keeps the same `data-testid="battle-unit"` and `data-dead`/`data-acting` hooks so existing BattleStage tests' assertions transfer.

**Files:**
- Create: `components/battle/UnitBust.tsx`
- Test: `tests/ui/battle.test.tsx` (new `describe('UnitBust')`)

**Interfaces:**
- Consumes: `ReplayUnit` (now with `tier`), `FloatDescriptor` (`./damageFloat`), `StatusIcons` (Task 8 — but to keep this task self-contained, render status inline here via a `statuses` prop of simple tokens; the dedicated `StatusIcons` component is wired in Task 8), `RarityFrame`, `PortraitImage`, `HouseCrest`.
- Produces: `function UnitBust(props): JSX.Element` with props:
  ```ts
  {
    unit: ReplayUnit
    hp: number
    acting?: boolean
    targeted?: boolean
    mirrored?: boolean
    float?: FloatDescriptor | null
    floatKey?: number | string
    statuses?: Array<'dot' | 'stun' | 'shield'>
  }
  ```
  Consumed by `BattleArena` (Task 9).

- [ ] **Step 1: Write the failing test**

Add to `tests/ui/battle.test.tsx`:

```ts
import { UnitBust } from '@/components/battle/UnitBust'

describe('UnitBust', () => {
  const u = {
    key: 'left:harry', side: 'left' as const, id: 'harry', name: 'Harry Potter',
    house: 'Grifondoro' as const, role: 'Attaccante' as const, tier: 1 as const, maxHp: 100,
  }
  it('renders the name, an HP value, and a rarity treatment', () => {
    render(<UnitBust unit={u} hp={72} />)
    expect(screen.getByText('Harry Potter')).toBeInTheDocument()
    expect(screen.getByTestId('battle-unit')).toBeInTheDocument()
  })
  it('flags a downed unit as dead', () => {
    render(<UnitBust unit={u} hp={0} />)
    expect(screen.getByTestId('battle-unit').getAttribute('data-dead')).toBe('true')
  })
  it('shows status icons when provided', () => {
    render(<UnitBust unit={u} hp={50} statuses={['dot', 'stun']} />)
    expect(screen.getByTestId('battle-unit').querySelectorAll('[data-status]').length).toBe(2)
  })
})
```

(`role` value: use whatever the project's `Role` union actually contains — read `types/wizard.ts` if `'Attaccante'` is wrong, and match an existing role string. `house` likewise must be a real `House` value.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/battle.test.tsx -t "UnitBust"`
Expected: FAIL — `Cannot find module '@/components/battle/UnitBust'`.

- [ ] **Step 3: Implement**

Create `components/battle/UnitBust.tsx`. Read `components/ui/RarityFrame.tsx` and `components/ui/PortraitImage.tsx` first to match their real prop signatures (RarityFrame wraps children with `tier`; PortraitImage takes `{ id, house, alt, variant }`). Implement:

```tsx
'use client'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Flame, Zap, Shield } from 'lucide-react'
import type { ReplayUnit } from '@/game/engine/combat/replay'
import { RarityFrame } from '@/components/ui/RarityFrame'
import { PortraitImage } from '@/components/ui/PortraitImage'
import { HpBar } from './HpBar'
import type { FloatDescriptor, FloatTone } from './damageFloat'
import { cn } from '@/lib/theme'

const FLOAT_CLASS: Record<FloatTone, string> = {
  damage: 'text-rose-300',
  crit: 'text-amber-300 text-xl font-bold drop-shadow-[0_0_8px_rgba(252,211,77,0.6)]',
  heal: 'text-emerald-300',
  dodge: 'text-white/60 text-[11px] uppercase tracking-wider',
}

const STATUS_ICON = { dot: Flame, stun: Zap, shield: Shield } as const
const STATUS_CLASS = {
  dot: 'text-orange-400',
  stun: 'text-yellow-300',
  shield: 'text-sky-300',
} as const

/**
 * Battle bust: rarity frame + face-cropped portrait + house crest + HP, with an
 * acting (green) / targeted (red) aura, status icons, KO tombstone, and a
 * floating damage/heal number. Reduced-motion → static final state.
 */
export function UnitBust({
  unit, hp, acting, targeted, mirrored, float, floatKey, statuses = [],
}: {
  unit: ReplayUnit
  hp: number
  acting?: boolean
  targeted?: boolean
  mirrored?: boolean
  float?: FloatDescriptor | null
  floatKey?: number | string
  statuses?: Array<'dot' | 'stun' | 'shield'>
}) {
  const reduce = useReducedMotion()
  const dead = hp <= 0
  const aura = acting ? '0 0 22px rgba(124,252,155,0.55)' : targeted ? '0 0 22px rgba(255,107,107,0.6)' : undefined

  return (
    <motion.div
      data-testid="battle-unit"
      data-dead={dead || undefined}
      data-acting={acting || undefined}
      animate={reduce ? {} : {
        scale: acting ? 1.04 : 1,
        x: targeted ? (mirrored ? -4 : 4) : 0,
      }}
      transition={{ type: 'spring', stiffness: 360, damping: 22 }}
      className={cn('relative w-28 sm:w-32', mirrored && 'text-right')}
      style={{ boxShadow: aura, borderRadius: 16, filter: dead ? 'grayscale(0.85)' : undefined }}
    >
      <RarityFrame tier={unit.tier}>
        <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl">
          <PortraitImage id={unit.id} house={unit.house} alt={unit.name} variant="bust" />
          {dead && (
            <div className="absolute inset-0 grid place-items-center bg-black/45">
              <span className="rounded border border-rose-400/50 bg-black/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-rose-300">
                Morto
              </span>
            </div>
          )}
        </div>
      </RarityFrame>

      <div className="mt-1 truncate text-center text-[11px] font-medium leading-tight">{unit.name}</div>
      <div className="mt-0.5"><HpBar hp={hp} maxHp={unit.maxHp} /></div>

      {statuses.length > 0 && (
        <div className={cn('absolute top-1 flex gap-1', mirrored ? 'left-1' : 'right-1')}>
          {statuses.map((s, i) => {
            const Icon = STATUS_ICON[s]
            return <Icon key={`${s}-${i}`} data-status={s} size={13} className={STATUS_CLASS[s]} />
          })}
        </div>
      )}

      <AnimatePresence>
        {float && (
          <motion.span
            key={floatKey}
            data-testid="damage-float"
            initial={reduce ? false : { opacity: 0, y: 4, scale: 0.8 }}
            animate={{ opacity: 1, y: reduce ? 0 : -26, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -40 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className={cn(
              'absolute left-1/2 -translate-x-1/2 top-2 pointer-events-none select-none font-display text-sm tabular-nums',
              FLOAT_CLASS[float.tone],
            )}
          >
            {float.text}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
```

If `RarityFrame` does not accept children (read it in Step 3), wrap the portrait with its actual API — e.g. render `<RarityFrame tier={unit.tier} />` as a sibling overlay, or pass the portrait via the prop it exposes. Preserve the `aspect-[3/4]` portrait, the name, `HpBar`, status icons, and all `data-*` hooks regardless of how the frame is composed.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/battle.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/battle/UnitBust.tsx tests/ui/battle.test.tsx
git commit -m "feat(battle): UnitBust with rarity frame, portrait, status icons"
```

---

## Task 7: `SpellFx` + `ShieldFx` — the 5-phase choreography

`SpellFx` plays a projectile/beam from caster→target using the archetype style; `ShieldFx` renders the Protego dome + "PARATO" when a hit is blocked. Both purely visual, reduced-motion → instant/skip.

**Files:**
- Create: `components/battle/SpellFx.tsx` (exports `SpellFx` and `ShieldFx`)
- Test: `tests/ui/battle.test.tsx` (new `describe('SpellFx')`)

**Interfaces:**
- Consumes: `LogEntry`, `archetypeFor`/`archetypeStyle` (Task 2), `useReducedMotion`.
- Produces:
  - `function SpellFx({ entry, fromMirrored, fxKey }: { entry: LogEntry | null; fromMirrored?: boolean; fxKey: number | string }): JSX.Element | null` — renders `data-testid="spell-fx"` with `data-archetype` when there's a projectile; returns `null` for archetype `none`/`shield`/`heal` (heal handled by the float, shield by ShieldFx).
  - `function ShieldFx({ active, fxKey }: { active: boolean; fxKey: number | string }): JSX.Element | null` — renders `data-testid="shield-fx"` with the "PARATO" label when `active`.

- [ ] **Step 1: Write the failing test**

Add to `tests/ui/battle.test.tsx`:

```ts
import { SpellFx, ShieldFx } from '@/components/battle/SpellFx'

describe('SpellFx', () => {
  it('renders a projectile with the archetype for a plain attack', () => {
    const e: LogEntry = {
      turn: 1, actorId: 'harry', actorSide: 'left', action: 'Stupeficium',
      targetId: 'draco', targetSide: 'right', type: 'Attacco', value: 10, flags: [],
    }
    render(<SpellFx entry={e} fxKey={1} />)
    const fx = screen.getByTestId('spell-fx')
    expect(fx.getAttribute('data-archetype')).toBe('beam')
  })
  it('renders nothing for a system KO entry', () => {
    const e: LogEntry = {
      turn: 1, actorId: 'harry', actorSide: 'left', action: 'KO',
      targetId: 'draco', targetSide: 'right', type: 'system', flags: ['kill'],
    }
    const { container } = render(<SpellFx entry={e} fxKey={1} />)
    expect(container.querySelector('[data-testid="spell-fx"]')).toBeNull()
  })
})

describe('ShieldFx', () => {
  it('shows PARATO when active', () => {
    render(<ShieldFx active fxKey={1} />)
    expect(screen.getByTestId('shield-fx')).toHaveTextContent(/parato/i)
  })
  it('renders nothing when inactive', () => {
    const { container } = render(<ShieldFx active={false} fxKey={1} />)
    expect(container.querySelector('[data-testid="shield-fx"]')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/battle.test.tsx -t "SpellFx"`
Expected: FAIL — `Cannot find module '@/components/battle/SpellFx'`.

- [ ] **Step 3: Implement**

Create `components/battle/SpellFx.tsx`:

```tsx
'use client'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import type { LogEntry } from '@/types'
import { archetypeFor, archetypeStyle } from '@/lib/spellArchetype'

/**
 * The travelling-spell effect: a projectile crosses caster→target. Phases
 * (charge→cast→flight→impact) are compressed into one motion timeline so it
 * stays cheap on mobile (transform/opacity only). Heal (handled by the float),
 * shield (ShieldFx), and system entries render nothing here.
 */
export function SpellFx({
  entry, fromMirrored = false, fxKey,
}: { entry: LogEntry | null; fromMirrored?: boolean; fxKey: number | string }) {
  const reduce = useReducedMotion()
  const archetype = archetypeFor(entry)
  if (archetype === 'none' || archetype === 'shield' || archetype === 'heal') return null
  const style = archetypeStyle(archetype)

  // Left caster fires rightward; right caster (mirrored) fires leftward.
  const fromX = fromMirrored ? '60%' : '40%'
  const toX = fromMirrored ? '40%' : '60%'

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <AnimatePresence>
        <motion.span
          key={fxKey}
          data-testid="spell-fx"
          data-archetype={archetype}
          initial={reduce ? { opacity: 1, left: toX, top: '50%' } : { opacity: 0.2, left: fromX, top: '50%', scale: 0.6 }}
          animate={{ opacity: 1, left: toX, top: '50%', scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.42, ease: 'easeIn' }}
          className="absolute h-3 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background: `radial-gradient(circle, ${style.color} 0%, ${style.trail} 70%, transparent 100%)`,
            boxShadow: `0 0 16px ${style.trail}`,
          }}
        />
      </AnimatePresence>
    </div>
  )
}

/**
 * Protego dome: a translucent blue sphere around the defender plus a "PARATO"
 * label and shockwave. Teaches the mechanic by contrast with a hit that lands.
 */
export function ShieldFx({ active, fxKey }: { active: boolean; fxKey: number | string }) {
  const reduce = useReducedMotion()
  if (!active) return null
  return (
    <div data-testid="shield-fx" className="pointer-events-none absolute inset-0 grid place-items-center">
      <motion.div
        key={`dome-${fxKey}`}
        initial={reduce ? { opacity: 0.5, scale: 1 } : { opacity: 0.1, scale: 0.6 }}
        animate={{ opacity: [0.6, 0.3], scale: [1, 1.15] }}
        transition={{ duration: reduce ? 0 : 0.5 }}
        className="h-24 w-24 rounded-full border-2 border-sky-300/70"
        style={{ background: 'radial-gradient(circle, rgba(125,211,252,0.25) 0%, transparent 70%)' }}
      />
      <span className="absolute font-display text-xs font-bold uppercase tracking-[0.22em] text-sky-200">
        Parato
      </span>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/battle.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/battle/SpellFx.tsx tests/ui/battle.test.tsx
git commit -m "feat(battle): SpellFx projectiles + ShieldFx Protego dome"
```

---

## Task 8: Per-frame status derivation (pure)

Status icons on busts (🔥 dot, 💫 stun, 🛡️ shield) must reflect the state implied by the log so far. Derive a `Record<unitKey, statuses[]>` for a given frame index — pure, testable, fed into `UnitBust.statuses` by the arena.

**Files:**
- Create: `lib/battleStatus.ts`
- Test: `tests/lib/battleStatus.test.ts`

**Interfaces:**
- Consumes: `Replay`, `unitKey`.
- Produces:
  - `type BattleStatusToken = 'dot' | 'stun' | 'shield'`
  - `function statusesAt(replay: Replay, index: number): Record<string, BattleStatusToken[]>`
  - consumed by `BattleArena` (Task 9).

  Heuristic (presentational only — does not read engine internals): scan frames `1..index`. A `dot` flag on a target marks that target with `dot` for a short window (next 2 frames). A `stun` flag/`Stordito` action marks the actor `stun` for that frame. A `Difesa`/`block` involving a unit marks it `shield` for the next frame. KO clears a unit. This is a *hint*, not authoritative state — it never affects HP.

- [ ] **Step 1: Write the failing test**

Create `tests/lib/battleStatus.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { statusesAt } from '@/lib/battleStatus'
import { buildReplay, unitKey } from '@/game/engine/combat/replay'
import { simulateBattle } from '@/game/engine/combat/simulate'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARD_BY_ID } from '@/data/wizards'
import type { DraftedWizard } from '@/types'

function team(ids: string[], seed = 1): DraftedWizard[] {
  const r = createRng(seed)
  return ids.map(id => draftWizard(r, WIZARD_BY_ID[id]!))
}

describe('statusesAt', () => {
  const l = team(['harry', 'ron', 'hermione', 'luna', 'neville'], 7)
  const r = team(['draco', 'crabbe', 'goyle', 'snape', 'bellatrix'], 13)
  const replay = buildReplay(simulateBattle(l, r, createRng(42)), l, r)

  it('returns an empty map at the initial frame', () => {
    expect(statusesAt(replay, 0)).toEqual({})
  })
  it('returns only known tokens for any frame', () => {
    const last = replay.frames.length - 1
    const map = statusesAt(replay, last)
    for (const tokens of Object.values(map)) {
      for (const t of tokens) expect(['dot', 'stun', 'shield']).toContain(t)
    }
  })
  it('does not mutate the replay', () => {
    const before = JSON.stringify(replay.frames.length)
    statusesAt(replay, 3)
    expect(JSON.stringify(replay.frames.length)).toBe(before)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/battleStatus.test.ts`
Expected: FAIL — `Cannot find module '@/lib/battleStatus'`.

- [ ] **Step 3: Implement**

Create `lib/battleStatus.ts`:

```ts
import type { Replay } from '@/game/engine/combat/replay'
import { unitKey } from '@/game/engine/combat/replay'

export type BattleStatusToken = 'dot' | 'stun' | 'shield'

/** How many subsequent frames a hint persists. */
const WINDOW = 2

/**
 * Presentational status hints for each unit at a given frame, derived from the
 * log flags. NOT authoritative engine state — it never affects HP, it only
 * surfaces what the log already says so the icons aren't "buried in the log".
 */
export function statusesAt(replay: Replay, index: number): Record<string, BattleStatusToken[]> {
  // lastSeen[key][token] = frame index where the hint was last (re)applied.
  const lastSeen: Record<string, Partial<Record<BattleStatusToken, number>>> = {}
  const dead = new Set<string>()

  const mark = (key: string, token: BattleStatusToken, at: number) => {
    ;(lastSeen[key] ??= {})[token] = at
  }

  for (let i = 1; i <= index && i < replay.frames.length; i++) {
    const e = replay.frames[i]!.entry
    if (!e) continue
    const actor = e.actorSide ? unitKey(e.actorSide, e.actorId) : null
    const target = e.targetSide && e.targetId ? unitKey(e.targetSide, e.targetId) : null

    if (e.flags.includes('kill') && target) dead.add(target)
    if (e.action === 'KO' && target) dead.add(target)

    if (e.flags.includes('dot') && target) mark(target, 'dot', i)
    if ((e.flags.includes('stun') || e.action === 'Stordito') && (target ?? actor)) {
      mark((target ?? actor)!, 'stun', i)
    }
    if ((e.type === 'Difesa' || e.flags.includes('block')) && actor) mark(actor, 'shield', i)
  }

  const out: Record<string, BattleStatusToken[]> = {}
  for (const [key, tokens] of Object.entries(lastSeen)) {
    if (dead.has(key)) continue
    const active: BattleStatusToken[] = []
    for (const [token, at] of Object.entries(tokens) as Array<[BattleStatusToken, number]>) {
      if (index - at < WINDOW) active.push(token)
    }
    if (active.length) out[key] = active
  }
  return out
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/battleStatus.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/battleStatus.ts tests/lib/battleStatus.test.ts
git commit -m "feat(battle): derive per-frame status hints from the log"
```

---

## Task 9: `BattleArena` + `ActionBanner` — assemble the staged battlefield

The arena replaces `BattleStage`: busts on both sides, the `SpellFx` layer between them, `ShieldFx` over a blocking defender, per-frame statuses, and a textual `ActionBanner` (CHI · COSA · su CHI · risultato) synced to the current entry.

**Files:**
- Create: `components/battle/BattleArena.tsx` (exports `BattleArena` and `ActionBanner`)
- Test: `tests/ui/battle.test.tsx` (new `describe('BattleArena')`)

**Interfaces:**
- Consumes: `Replay`, `LogEntry`, `UnitBust` (Task 6), `SpellFx`/`ShieldFx` (Task 7), `statusesAt` (Task 8), `floatFor` (`./damageFloat`), `archetypeFor` (Task 2), `describeEntry` (`./BattleLog`), `unitKey`.
- Produces:
  - `function BattleArena({ replay, hp, entry, frameKey, leftTitle, rightTitle }): JSX.Element` — same prop shape as the old `BattleStage` plus it internally derives statuses/fx. Renders `data-testid="battle-arena"`.
  - `function ActionBanner({ entry, units }: { entry: LogEntry | null; units: ReplayUnit[] }): JSX.Element` — one-line synced narration; `data-testid="action-banner"`.

- [ ] **Step 1: Write the failing test**

Add to `tests/ui/battle.test.tsx`:

```ts
import { BattleArena, ActionBanner } from '@/components/battle/BattleArena'

describe('BattleArena', () => {
  it('renders every combatant as a bust', () => {
    const l = left(), r = right()
    const replay = buildReplay(simulateBattle(l, r, createRng(42)), l, r)
    render(<BattleArena replay={replay} hp={replay.frames[0]!.hp} entry={null} frameKey={0} />)
    expect(screen.getAllByTestId('battle-unit')).toHaveLength(10)
  })
  it('shows the Protego dome when a hit is blocked', () => {
    const l = left(), r = right()
    const replay = buildReplay(simulateBattle(l, r, createRng(42)), l, r)
    const blocked: LogEntry = {
      turn: 1, actorId: 'harry', actorSide: 'left', action: 'Stupeficium',
      targetId: 'draco', targetSide: 'right', type: 'Attacco', value: 0, flags: ['block'],
    }
    render(<BattleArena replay={replay} hp={replay.frames[0]!.hp} entry={blocked} frameKey={1} />)
    expect(screen.getByTestId('shield-fx')).toBeInTheDocument()
  })
})

describe('ActionBanner', () => {
  it('narrates the current entry', () => {
    const l = left(), r = right()
    const replay = buildReplay(simulateBattle(l, r, createRng(42)), l, r)
    const e: LogEntry = {
      turn: 1, actorId: 'harry', actorSide: 'left', action: 'Stupeficium',
      targetId: 'draco', targetSide: 'right', type: 'Attacco', value: 42, flags: [],
    }
    render(<ActionBanner entry={e} units={replay.units} />)
    expect(screen.getByTestId('action-banner')).toHaveTextContent('42')
  })
  it('renders an empty placeholder for no entry', () => {
    const l = left(), r = right()
    const replay = buildReplay(simulateBattle(l, r, createRng(42)), l, r)
    render(<ActionBanner entry={null} units={replay.units} />)
    expect(screen.getByTestId('action-banner')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/battle.test.tsx -t "BattleArena"`
Expected: FAIL — `Cannot find module '@/components/battle/BattleArena'`.

- [ ] **Step 3: Implement**

Create `components/battle/BattleArena.tsx`:

```tsx
'use client'
import type { LogEntry } from '@/types'
import type { Replay, ReplayUnit } from '@/game/engine/combat/replay'
import { unitKey } from '@/game/engine/combat/replay'
import { UnitBust } from './UnitBust'
import { SpellFx, ShieldFx } from './SpellFx'
import { floatFor } from './damageFloat'
import { describeEntry } from './BattleLog'
import { statusesAt } from '@/lib/battleStatus'
import { archetypeFor } from '@/lib/spellArchetype'

/**
 * Staged battlefield: player's busts on the left, enemies on the right, the
 * spell-effect layer between them, and the Protego dome over a blocking
 * defender. Statuses are derived per frame; HP comes from the current frame.
 */
export function BattleArena({
  replay, hp, entry, frameKey = 0, leftTitle = 'La tua squadra', rightTitle = 'Avversari',
}: {
  replay: Replay
  hp: Record<string, number>
  entry: LogEntry | null
  frameKey?: number
  leftTitle?: string
  rightTitle?: string
}) {
  const actingKey = entry?.actorSide ? unitKey(entry.actorSide, entry.actorId) : null
  const targetKey = entry?.targetSide && entry.targetId ? unitKey(entry.targetSide, entry.targetId) : null
  const float = floatFor(entry)
  const statuses = statusesAt(replay, frameKey)
  const blocked = !!entry && (entry.flags.includes('block') || archetypeFor(entry) === 'shield')

  const left = replay.units.filter(u => u.side === 'left')
  const right = replay.units.filter(u => u.side === 'right')
  const actorMirrored = entry?.actorSide === 'right'

  const renderSide = (units: ReplayUnit[], mirrored: boolean) =>
    units.map(u => (
      <div key={u.key} className="relative">
        <UnitBust
          unit={u}
          hp={hp[u.key] ?? 0}
          acting={u.key === actingKey}
          targeted={u.key === targetKey}
          mirrored={mirrored}
          float={u.key === targetKey ? float : null}
          floatKey={frameKey}
          statuses={statuses[u.key] ?? []}
        />
        {u.key === targetKey && <ShieldFx active={blocked} fxKey={frameKey} />}
      </div>
    ))

  return (
    <div data-testid="battle-arena" className="relative flex items-start justify-center gap-4 sm:gap-10 w-full">
      <section className="flex flex-col items-center gap-3">
        <h3 className="text-xs uppercase tracking-widest text-white/40">{leftTitle}</h3>
        <div className="flex flex-wrap justify-center gap-2 sm:gap-3">{renderSide(left, false)}</div>
      </section>

      <div className="self-center font-display text-2xl text-white/30 select-none">VS</div>

      <section className="flex flex-col items-center gap-3">
        <h3 className="text-xs uppercase tracking-widest text-white/40">{rightTitle}</h3>
        <div className="flex flex-wrap justify-center gap-2 sm:gap-3">{renderSide(right, true)}</div>
      </section>

      {!blocked && <SpellFx entry={entry} fromMirrored={actorMirrored} fxKey={frameKey} />}
    </div>
  )
}

/** One-line synced narration anchoring the animation in text. */
export function ActionBanner({ entry, units }: { entry: LogEntry | null; units: ReplayUnit[] }) {
  const names: Record<string, string> = {}
  for (const u of units) names[u.key] = u.name
  return (
    <div
      data-testid="action-banner"
      className="glass rounded-full px-4 py-1.5 text-sm text-white/80 min-h-[2rem] grid place-items-center"
    >
      {entry ? describeEntry(entry, names) : <span className="text-white/30">…</span>}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/battle.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/battle/BattleArena.tsx tests/ui/battle.test.tsx
git commit -m "feat(battle): BattleArena staging busts, fx, shield, banner"
```

---

## Task 10: Rewire `BattleScreen` — rhythm controls + new arena

Replace the `BattleStage` body with `InitiativeBar` + `BattleArena` + `ActionBanner`, and expand controls to include step-by-step (`step`/`stepBack`). Keep `BattleLog` below as the scrollable history, and keep the existing `onFinish` / skip behavior so the BattleScreen test stays green.

**Files:**
- Modify: `components/screens/BattleScreen.tsx`
- Test: `tests/ui/battle.test.tsx` (existing BattleScreen test must stay green; add a step-control test)

**Interfaces:**
- Consumes: `BattleArena`/`ActionBanner` (Task 9), `InitiativeBar` (Task 5), `useBattleReplay` with `step`/`stepBack` (Task 4).
- Produces: same `BattleScreen` public props (unchanged) — `CampaignRunner.tsx:59` keeps working without edits.

- [ ] **Step 1: Write the failing test**

Add to the existing `describe('BattleScreen')` in `tests/ui/battle.test.tsx`:

```ts
it('advances one action with the step control', async () => {
  const l = left(), r = right()
  const result = simulateBattle(l, r, createRng(42), {
    leftSyn: detectSynergies(l), rightSyn: detectSynergies(r),
  })
  render(
    <BattleScreen
      result={result} playerTeam={l} playerSyn={detectSynergies(l)}
      enemy={r} enemySyn={detectSynergies(r)} title="Sfida 1 di 5" onFinish={vi.fn()}
    />,
  )
  // Pause first so autoplay doesn't race the assertion, then step.
  await userEvent.click(screen.getByRole('button', { name: /pausa|play/i }))
  const stepBtn = screen.getByRole('button', { name: /passo/i })
  await userEvent.click(stepBtn)
  expect(screen.getByTestId('battle-arena')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/battle.test.tsx -t "step control"`
Expected: FAIL — no button matching `/passo/i`.

- [ ] **Step 3: Rewrite BattleScreen**

Replace `components/screens/BattleScreen.tsx` with:

```tsx
'use client'
import { useMemo } from 'react'
import { Play, Pause, SkipForward, FastForward, ChevronRight } from 'lucide-react'
import type { ActiveRelic, ActiveSynergy, BattleResult, DraftedWizard } from '@/types'
import { buildReplay } from '@/game/engine/combat/replay'
import { useBattleReplay, REPLAY_SPEEDS } from '@/hooks/useBattleReplay'
import { InitiativeBar } from '@/components/battle/InitiativeBar'
import { BattleArena, ActionBanner } from '@/components/battle/BattleArena'
import { BattleLog } from '@/components/battle/BattleLog'
import { Button } from '@/components/ui/Button'

export function BattleScreen({
  result, playerTeam, playerSyn, playerRelics, enemy, enemySyn, title, rightTitle, onFinish,
}: {
  result: BattleResult
  playerTeam: DraftedWizard[]
  playerSyn: ActiveSynergy[]
  playerRelics?: ActiveRelic[]
  enemy: DraftedWizard[]
  enemySyn: ActiveSynergy[]
  title: string
  rightTitle?: string
  onFinish: () => void
}) {
  const replay = useMemo(
    () => buildReplay(result, playerTeam, enemy, { leftSyn: playerSyn, rightSyn: enemySyn, leftRelics: playerRelics ?? [] }),
    [result, playerTeam, enemy, playerSyn, enemySyn, playerRelics],
  )
  const r = useBattleReplay(replay)

  return (
    <main className="flex-1 flex flex-col items-center gap-5 p-4 sm:p-6">
      <div className="flex flex-col items-center gap-1">
        <h1 className="font-display text-2xl">{title}</h1>
        <p className="text-[11px] uppercase tracking-widest text-white/35">
          Turno {r.entry?.turn ?? 0} · azione {r.index}/{r.total - 1}
        </p>
      </div>

      <InitiativeBar replay={replay} index={r.index} />

      <BattleArena replay={replay} hp={r.hp} entry={r.entry} frameKey={r.index} rightTitle={rightTitle} />

      <ActionBanner entry={r.entry} units={replay.units} />

      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
        {!r.done ? (
          <>
            <Button variant="ghost" onClick={r.toggle} className="px-4" aria-label={r.playing ? 'Pausa' : 'Play'}>
              {r.playing ? <Pause size={18} /> : <Play size={18} />}
            </Button>
            <Button variant="ghost" onClick={r.step} className="px-4 gap-1 inline-flex items-center" aria-label="Passo">
              <ChevronRight size={16} /> Passo
            </Button>
            <Button
              variant="ghost"
              onClick={() => r.setSpeed(REPLAY_SPEEDS[(REPLAY_SPEEDS.indexOf(r.speed) + 1) % REPLAY_SPEEDS.length]!)}
              className="px-4 gap-1 inline-flex items-center"
            >
              <FastForward size={16} /> {r.speed}×
            </Button>
            <Button variant="ghost" onClick={r.skip} className="px-4 gap-1 inline-flex items-center">
              <SkipForward size={16} /> Salta
            </Button>
          </>
        ) : (
          <Button onClick={onFinish}>
            {result.winner === 'left' ? 'Continua' : 'Vedi esito'}
          </Button>
        )}
      </div>

      <BattleLog entries={replay.frames.slice(1, r.index + 1).map(f => f.entry!)} units={replay.units} />
    </main>
  )
}
```

- [ ] **Step 4: Run the full battle suite**

Run: `npx vitest run tests/ui/battle.test.tsx`
Expected: PASS — existing BattleScreen skip/onFinish test, the new step-control test, and all arena/bust/fx tests.

- [ ] **Step 5: Commit**

```bash
git add components/screens/BattleScreen.tsx tests/ui/battle.test.tsx
git commit -m "feat(battle): rewire BattleScreen with initiative, arena, step controls"
```

---

## Task 11: Retire `BattleStage`, full suite, build, manual check

`BattleStage`/`BattleUnit` are superseded by `BattleArena`/`UnitBust`. Remove them and their now-dead tests if nothing else imports them; otherwise leave a note. Then prove the whole suite + build are green and the screen renders.

**Files:**
- Possibly delete: `components/battle/BattleStage.tsx`, `components/battle/BattleUnit.tsx`
- Modify: `tests/ui/battle.test.tsx` (drop the old `describe('BattleStage')` block — its coverage moved to `BattleArena`)

- [ ] **Step 1: Confirm no remaining importers**

Run: `grep -rn "BattleStage\|BattleUnit" components/ app/ hooks/ --include=*.tsx --include=*.ts | grep -v "BattleStage.tsx\|BattleUnit.tsx"`
Expected: only matches inside `tests/` (the old describe block). If a non-test file still imports them, **do not delete** — instead leave them and skip Step 2, noting it in the commit.

- [ ] **Step 2: Remove superseded files + their tests**

```bash
git rm components/battle/BattleStage.tsx components/battle/BattleUnit.tsx
```

Remove the old `describe('BattleStage')` block from `tests/ui/battle.test.tsx` (the new `describe('BattleArena')` replaces its assertions: 10 busts, dead marking, damage float).

- [ ] **Step 3: Run the full test suite**

Run: `npx vitest run`
Expected: PASS — all tests green, count ≥ prior 367 minus the retired BattleStage cases plus the new ones (net increase). Note the final number.

- [ ] **Step 4: Production build + typecheck**

Run: `npm run build`
Expected: clean build, no TypeScript errors.

- [ ] **Step 5: Manual smoke (reduced-motion + normal)**

Run: `npm run dev`, play a campaign battle. Verify: initiative bar highlights the actor, projectiles cross caster→target, a Protego shows "PARATO", HP bars fall, KO'd units go grey-in-place, step/play/speed/skip all work. Then re-check with OS "reduce motion" on — the battle must still be fully playable (static fallback). Stop the dev server.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(battle): retire BattleStage/BattleUnit, superseded by arena"
```

---

## Self-Review (against spec §7 / §9 / §10)

- **Initiative order by speed (§7)** → Task 3 (`initiative.ts`) + Task 5 (`InitiativeBar`). Derived from the replay sequence, no engine turn-queue — matches the spec's "sorgente dati" requirement. ✓
- **5-phase choreography (§7)** → Task 7 (`SpellFx`) compresses charge→cast→flight→impact into one motion timeline; recoil/HP-drop handled by `UnitBust` (`x` shake) + `HpBar`. ✓
- **Animation vocabulary by spell type (§7)** → Task 2 (`spellArchetype.ts`) maps `LogEntry` → archetype+color via data. ✓
- **Protego = dome / "PARATO" / 0 damage (§7)** → Task 7 (`ShieldFx`) + Task 9 wiring on `block`/Difesa. ✓
- **Status icons (§7)** → Task 8 (`battleStatus.ts`) + Task 6 (`UnitBust` icons). ✓
- **HP bars red/green, fallen grey-in-place (§7)** → existing `HpBar` (kept) + `UnitBust` dead state (grayscale, "Morto"). ✓
- **Action banner CHI·COSA·su CHI·risultato (§7)** → Task 9 (`ActionBanner`, reuses `describeEntry`). ✓
- **Rhythm controls: play/pause, step, speed, skip (§7)** → Task 4 (`step`/`stepBack`) + Task 10 (controls). ✓
- **Determinism unchanged (§7/§10)** → engine untouched except read-only `tier` (Task 1); replay/seed regression tests stay the gate (Task 11 full suite). ✓
- **prefers-reduced-motion fallback (§7/§10)** → `useReducedMotion` in `UnitBust`/`SpellFx`/`ShieldFx`; CSS `.resa-animated` rule already present. ✓
- **Architecture split (§9)**: playback hook (`useBattleReplay`+step) vs presentation (`BattleArena`, `SpellFx`, `ShieldFx`, `UnitBust`, `InitiativeBar`) — `SpellFx` maps type→archetype via data; `BattleScreen` broken up. ✓
- **Reuse Plan-1 primitives (§9)**: `RarityFrame`/`PortraitImage`/`HouseCrest`/`rarityStyle` consumed by `UnitBust`/`InitiativeBar`. ✓
- **Testing coverage (§10)**: pure libs (archetype, initiative, status), components (bust/arena/initiative/fx), determinism (replay tests), reduced-motion path present. ✓

**Out of scope (correctly deferred to Plan 4):** boss fix, tier compression, synergy scaling — none touched here. Portrait art batch is non-blocking (fallback silhouette already ships).
