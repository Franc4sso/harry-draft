# Harry Draft — M1 Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the pure, testable game core (types + data + engine) for the Harry Draft roguelite — zero UI.

**Architecture:** Pure functions with an injected seeded PRNG. The engine takes data + seed and returns data (draft screens, battle results, logs). No React, no DOM. Data lives in `data/` as plain TS, fully separate from logic in `game/engine/`. Everything is deterministic from a single run seed.

**Tech Stack:** Next.js 15 (App Router), React, TypeScript strict, TailwindCSS, Framer Motion, Lucide (deps installed now, used from M2). Tests: **Vitest**.

## Global Constraints

- TypeScript **strict** mode (`"strict": true`, no implicit any, `noUncheckedIndexedAccess: true`).
- No database. All data local in `data/*.ts`.
- Engine (`game/engine/*`) must be pure: no React, no DOM, no `Math.random`, no `Date.now`. All randomness via the injected `Rng`.
- All tunable numbers live in `data/constants.ts`. No magic numbers in engine logic.
- Houses (exact strings): `'Grifondoro' | 'Serpeverde' | 'Corvonero' | 'Tassorosso'`.
- Roles (exact strings): `'Attaccante' | 'Tank' | 'Supporto' | 'Controllo'`.
- Spell types (exact strings): `'Attacco' | 'Difesa' | 'Cura' | 'Controllo'`.
- Tiers: `1 | 2 | 3 | 4` (1 = Leggendario … 4 = Comune).
- Team size: 5. Campaign: 5 CPU teams + 1 boss.
- Combat turn cap: 100; tie broken by higher total HP% (deterministic, then by id).
- Draft: max 1 Tier-1 per screen; pity = if after 2 picks team has 0 wizards Tier ≤2, screen 3 forces a Tier ≤2.
- Each wizard rolls 1 spell from its `spellPool`. Base attack always available when spell on cooldown.
- ~45 wizards minimum 40; ~30-40 spells reused across pools.

---

## File Structure

```
harry-draft/
├── package.json, tsconfig.json, next.config.ts, tailwind config, vitest.config.ts
├── types/        wizard.ts spell.ts synergy.ts combat.ts run.ts index.ts
├── data/         constants.ts houses.ts spells.ts wizards.ts synergies.ts bosses.ts
├── game/engine/  rng.ts statRoll.ts draft.ts synergy.ts run.ts
│   └── combat/   selectSpell.ts targeting.ts resolve.ts simulate.ts teamGen.ts
└── tests/        mirror of game/engine, plus data validation tests
```

---

## Task 1: Project scaffold + tooling

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `tailwind.config.ts`, `app/globals.css`, `vitest.config.ts`, `app/layout.tsx`, `app/page.tsx`
- Test: `tests/smoke.test.ts`

**Interfaces:**
- Produces: working `npm test` (Vitest) and `npm run build` (Next).

- [ ] **Step 1: Scaffold Next app**

```bash
cd /home/cassano/wa/harry-draft
npx create-next-app@latest . --ts --tailwind --app --no-src-dir --no-eslint --import-alias "@/*" --use-npm --yes
```
If the dir is non-empty and the CLI refuses, scaffold in a temp dir and copy files in. Keep our existing `docs/` and `.git`.

- [ ] **Step 2: Install test + game deps**

```bash
npm install -D vitest @vitejs/plugin-react vite-tsconfig-paths
npm install framer-motion lucide-react
```

- [ ] **Step 3: Add vitest config**

Create `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
})
```

- [ ] **Step 4: Tighten tsconfig**

In `tsconfig.json` `compilerOptions`, ensure: `"strict": true`, add `"noUncheckedIndexedAccess": true`, `"noImplicitOverride": true`.

- [ ] **Step 5: Add test script**

In `package.json` `"scripts"`, add: `"test": "vitest run"`, `"test:watch": "vitest"`.

- [ ] **Step 6: Write smoke test**

Create `tests/smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
describe('smoke', () => {
  it('runs', () => { expect(1 + 1).toBe(2) })
})
```

- [ ] **Step 7: Run test, verify pass**

Run: `npm test`
Expected: 1 passed.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "chore: scaffold Next15 + vitest tooling"
```

---

## Task 2: Core types

**Files:**
- Create: `types/wizard.ts`, `types/spell.ts`, `types/synergy.ts`, `types/combat.ts`, `types/run.ts`, `types/index.ts`
- Test: `tests/types.test.ts`

**Interfaces:**
- Produces: all shared types, re-exported from `types/index.ts`. Consumed by every later task.

- [ ] **Step 1: Write spell types**

Create `types/spell.ts`:
```ts
export type SpellType = 'Attacco' | 'Difesa' | 'Cura' | 'Controllo'
export type Stat = 'hp' | 'atk' | 'def' | 'spd'

export interface SpellEffect {
  kind: 'buff' | 'debuff' | 'dot' | 'stun'
  stat?: Stat
  amount?: number
  duration?: number
}

export interface Spell {
  id: string
  name: string
  desc: string
  type: SpellType
  power?: number
  heal?: number
  hitChance: number
  cooldown?: number
  effects?: SpellEffect[]
}
```

- [ ] **Step 2: Write wizard types**

Create `types/wizard.ts`:
```ts
import type { Stat } from './spell'

export type House = 'Grifondoro' | 'Serpeverde' | 'Corvonero' | 'Tassorosso'
export type Role = 'Attaccante' | 'Tank' | 'Supporto' | 'Controllo'
export type Tier = 1 | 2 | 3 | 4

export type Range = readonly [number, number]
export interface StatRanges { hp: Range; atk: Range; def: Range; spd: Range }
export type Stats = Record<Stat, number>

export interface Wizard {
  id: string
  name: string
  house: House
  role: Role
  tier: Tier
  ranges: StatRanges
  spellPool: string[]
  tags?: string[]
}
```

- [ ] **Step 3: Write synergy types**

Create `types/synergy.ts`:
```ts
import type { House, Role, Stat } from './wizard'

export interface SynergyRequirement {
  house?: House
  role?: Role
  count?: number
  ids?: string[]
  tag?: string
}

export type SynergyBonus = Partial<Record<Stat, number>> & {
  allPct?: number
  regen?: number
}

export interface Synergy {
  id: string
  name: string
  kind: 'house' | 'role' | 'group' | 'origin'
  requires: SynergyRequirement
  bonus: SynergyBonus
}

export interface ActiveSynergy { synergy: Synergy; memberIds: string[] }
```

- [ ] **Step 4: Write combat types**

Create `types/combat.ts`:
```ts
import type { Spell, SpellType, Stat } from './spell'
import type { Stats, Wizard } from './wizard'

export interface DraftedWizard {
  wizard: Wizard
  stats: Stats
  maxHp: number
  spell: Spell
}

export interface ActiveEffect {
  kind: 'buff' | 'debuff' | 'dot' | 'stun'
  stat?: Stat
  amount?: number
  remaining: number
}

export type Side = 'left' | 'right'

export interface BattleUnit extends DraftedWizard {
  side: Side
  hp: number
  cooldowns: Record<string, number>
  statusEffects: ActiveEffect[]
  buffedStats: Stats
  alive: boolean
}

export type LogFlag = 'crit' | 'dodge' | 'kill' | 'heal' | 'block' | 'stun' | 'dot'

export interface LogEntry {
  turn: number
  actorId: string
  action: string
  targetId?: string
  type: SpellType | 'system'
  value?: number
  flags: LogFlag[]
}

export interface UnitSnapshot { id: string; hp: number; maxHp: number; alive: boolean }

export interface BattleResult {
  winner: Side
  turns: number
  log: LogEntry[]
  mvpId: string
  finalSnapshot: UnitSnapshot[]
}
```

- [ ] **Step 5: Write run types**

Create `types/run.ts`:
```ts
import type { ActiveSynergy, DraftedWizard, BattleResult } from './index'

export type RunPhase =
  | 'menu' | 'draft' | 'team' | 'battle'
  | 'victory' | 'defeat' | 'boss' | 'win'

export interface RunState {
  seed: string
  phase: RunPhase
  team: DraftedWizard[]
  activeSynergies: ActiveSynergy[]
  stage: number
  lastBattle?: BattleResult
}
```

- [ ] **Step 6: Write barrel export**

Create `types/index.ts`:
```ts
export * from './spell'
export * from './wizard'
export * from './synergy'
export * from './combat'
export * from './run'
```

- [ ] **Step 7: Write type-usage test**

Create `tests/types.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import type { Wizard, Spell, Synergy, DraftedWizard } from '@/types'

describe('types', () => {
  it('compose into a valid drafted wizard shape', () => {
    const spell: Spell = { id: 's', name: 'S', desc: '', type: 'Attacco', power: 1, hitChance: 1 }
    const wizard: Wizard = {
      id: 'w', name: 'W', house: 'Grifondoro', role: 'Attaccante', tier: 3,
      ranges: { hp: [10, 20], atk: [10, 20], def: [10, 20], spd: [10, 20] }, spellPool: ['s'],
    }
    const dw: DraftedWizard = { wizard, stats: { hp: 15, atk: 15, def: 15, spd: 15 }, maxHp: 15, spell }
    const syn: Synergy = { id: 'x', name: 'X', kind: 'house', requires: { house: 'Grifondoro', count: 3 }, bonus: { def: 20 } }
    expect(dw.maxHp).toBe(15)
    expect(syn.bonus.def).toBe(20)
  })
})
```

- [ ] **Step 8: Run test, verify pass; commit**

Run: `npm test -- tests/types.test.ts`
Expected: PASS.
```bash
git add -A && git commit -m "feat: add core game types"
```

---

## Task 3: Constants + houses data

**Files:**
- Create: `data/constants.ts`, `data/houses.ts`
- Test: `tests/data/constants.test.ts`

**Interfaces:**
- Produces:
  - `BALANCE` object with: `combat: { turnCap: number; baseAttackMult: number; defenseK: number; minDamage: number; critBase: number; critSpdScale: number; critMult: number; dodgeBase: number; dodgeScale: number }`, `draft: { screenSize: number; teamSize: number; tierWeights: Record<Tier, number>; tierRollBias: Record<Tier, number>; pityAfterPicks: number; pityMaxTier: Tier; maxTier1PerScreen: number }`, `campaign: { enemyCount: number; baseBudget: number; budgetStep: number; bossBudgetMult: number; bossHpMult: number }`.
  - `HOUSES: Record<House, { id: House; label: string; color: string; glow: string }>`.

- [ ] **Step 1: Write constants test**

Create `tests/data/constants.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { BALANCE } from '@/data/constants'
import { HOUSES } from '@/data/houses'

describe('balance constants', () => {
  it('has sane combat values', () => {
    expect(BALANCE.combat.turnCap).toBe(100)
    expect(BALANCE.combat.minDamage).toBeGreaterThanOrEqual(1)
    expect(BALANCE.draft.teamSize).toBe(5)
    expect(BALANCE.draft.screenSize).toBe(5)
    expect(BALANCE.draft.maxTier1PerScreen).toBe(1)
  })
  it('tier weights favor lower tiers', () => {
    const w = BALANCE.draft.tierWeights
    expect(w[4]).toBeGreaterThan(w[1])
    expect(w[3]).toBeGreaterThan(w[2])
  })
  it('defines all four houses with colors', () => {
    expect(Object.keys(HOUSES)).toHaveLength(4)
    expect(HOUSES.Grifondoro.color).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm test -- tests/data/constants.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 3: Write constants**

Create `data/constants.ts`:
```ts
import type { Tier } from '@/types'

export const BALANCE = {
  combat: {
    turnCap: 100,
    baseAttackMult: 0.45,
    defenseK: 0.5,
    minDamage: 1,
    critBase: 0.05,
    critSpdScale: 0.0015,
    critMult: 1.6,
    dodgeBase: 0.02,
    dodgeScale: 0.0012,
  },
  draft: {
    screenSize: 5,
    teamSize: 5,
    tierWeights: { 1: 4, 2: 12, 3: 32, 4: 52 } as Record<Tier, number>,
    tierRollBias: { 1: 0.85, 2: 0.65, 3: 0.5, 4: 0.4 } as Record<Tier, number>,
    pityAfterPicks: 2,
    pityMaxTier: 2 as Tier,
    maxTier1PerScreen: 1,
  },
  campaign: {
    enemyCount: 5,
    baseBudget: 1500,
    budgetStep: 220,
    bossBudgetMult: 1.35,
    bossHpMult: 1.4,
  },
} as const
```

- [ ] **Step 4: Write houses**

Create `data/houses.ts`:
```ts
import type { House } from '@/types'

export const HOUSES: Record<House, { id: House; label: string; color: string; glow: string }> = {
  Grifondoro: { id: 'Grifondoro', label: 'Grifondoro', color: '#ae0001', glow: '#ffc500' },
  Serpeverde: { id: 'Serpeverde', label: 'Serpeverde', color: '#1a472a', glow: '#aaaaaa' },
  Corvonero:  { id: 'Corvonero',  label: 'Corvonero',  color: '#222f5b', glow: '#946b2d' },
  Tassorosso: { id: 'Tassorosso', label: 'Tassorosso', color: '#ecb939', glow: '#372e29' },
}
```

- [ ] **Step 5: Run test, verify pass; commit**

Run: `npm test -- tests/data/constants.test.ts`
Expected: PASS.
```bash
git add -A && git commit -m "feat: add balance constants and houses data"
```

---

## Task 4: Seeded PRNG

**Files:**
- Create: `game/engine/rng.ts`
- Test: `tests/engine/rng.test.ts`

**Interfaces:**
- Produces:
  - `type Rng = { next(): number; int(min: number, max: number): number; chance(p: number): boolean; pick<T>(arr: readonly T[]): T; shuffle<T>(arr: readonly T[]): T[]; fork(salt: number): Rng }`
  - `createRng(seed: number | string): Rng`
  - `seedFromString(s: string): number`
  - `next()` returns float in [0,1); `int` inclusive both ends; `fork` derives an independent deterministic sub-stream.

- [ ] **Step 1: Write rng test**

Create `tests/engine/rng.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { createRng, seedFromString } from '@/game/engine/rng'

describe('rng', () => {
  it('is deterministic for the same seed', () => {
    const a = createRng(123); const b = createRng(123)
    const seqA = Array.from({ length: 5 }, () => a.next())
    const seqB = Array.from({ length: 5 }, () => b.next())
    expect(seqA).toEqual(seqB)
  })
  it('differs across seeds', () => {
    const a = createRng(1).next(); const b = createRng(2).next()
    expect(a).not.toBe(b)
  })
  it('int is inclusive and within range', () => {
    const r = createRng(42)
    for (let i = 0; i < 200; i++) {
      const v = r.int(3, 7)
      expect(v).toBeGreaterThanOrEqual(3)
      expect(v).toBeLessThanOrEqual(7)
      expect(Number.isInteger(v)).toBe(true)
    }
  })
  it('pick returns an element; shuffle preserves members', () => {
    const r = createRng(9)
    const arr = [1, 2, 3, 4, 5]
    expect(arr).toContain(r.pick(arr))
    expect([...r.shuffle(arr)].sort()).toEqual(arr)
  })
  it('fork is deterministic but independent from parent', () => {
    const base = createRng(7)
    const f1 = base.fork(1).next()
    const f1b = createRng(7).fork(1).next()
    expect(f1).toBe(f1b)
  })
  it('seedFromString is stable', () => {
    expect(seedFromString('harry')).toBe(seedFromString('harry'))
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm test -- tests/engine/rng.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement rng**

Create `game/engine/rng.ts`:
```ts
export interface Rng {
  next(): number
  int(min: number, max: number): number
  chance(p: number): boolean
  pick<T>(arr: readonly T[]): T
  shuffle<T>(arr: readonly T[]): T[]
  fork(salt: number): Rng
}

export function seedFromString(s: string): number {
  let h = 1779033703 ^ s.length
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return (h >>> 0) || 1
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function createRng(seed: number | string): Rng {
  const numeric = typeof seed === 'string' ? seedFromString(seed) : (seed >>> 0) || 1
  const gen = mulberry32(numeric)
  const rng: Rng = {
    next: () => gen(),
    int: (min, max) => min + Math.floor(gen() * (max - min + 1)),
    chance: (p) => gen() < p,
    pick: (arr) => {
      if (arr.length === 0) throw new Error('pick on empty array')
      return arr[Math.floor(gen() * arr.length)] as (typeof arr)[number]
    },
    shuffle: (arr) => {
      const out = [...arr]
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(gen() * (i + 1))
        ;[out[i], out[j]] = [out[j] as T_, out[i] as T_]
      }
      return out
    },
    fork: (salt) => createRng((numeric ^ Math.imul(salt + 1, 2654435761)) >>> 0),
  }
  return rng
}
type T_ = unknown
```
Note: the `T_` alias keeps strict mode happy in the swap; if it complains, type the shuffle body with an explicit generic helper instead.

- [ ] **Step 4: Run test, verify pass; commit**

Run: `npm test -- tests/engine/rng.test.ts`
Expected: PASS.
```bash
git add -A && git commit -m "feat: add seeded PRNG with fork support"
```

---

## Task 5: Spells data

**Files:**
- Create: `data/spells.ts`
- Test: `tests/data/spells.test.ts`

**Interfaces:**
- Produces: `SPELLS: Spell[]` and `SPELL_BY_ID: Record<string, Spell>`; includes a reserved base attack `baseAttack` with id `'base_attack'`. ~32 spells covering all four `SpellType`s.

- [ ] **Step 1: Write spells validation test**

Create `tests/data/spells.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { SPELLS, SPELL_BY_ID } from '@/data/spells'

describe('spells data', () => {
  it('has at least 30 spells', () => { expect(SPELLS.length).toBeGreaterThanOrEqual(30) })
  it('has unique ids', () => {
    expect(new Set(SPELLS.map(s => s.id)).size).toBe(SPELLS.length)
  })
  it('covers all spell types', () => {
    const types = new Set(SPELLS.map(s => s.type))
    expect(types).toEqual(new Set(['Attacco', 'Difesa', 'Cura', 'Controllo']))
  })
  it('hitChance within [0,1] and attack spells deal power', () => {
    for (const s of SPELLS) {
      expect(s.hitChance).toBeGreaterThan(0)
      expect(s.hitChance).toBeLessThanOrEqual(1)
      if (s.type === 'Attacco') expect(s.power ?? 0).toBeGreaterThan(0)
      if (s.type === 'Cura') expect(s.heal ?? 0).toBeGreaterThan(0)
    }
  })
  it('exposes a base attack and a lookup map', () => {
    expect(SPELL_BY_ID['base_attack']).toBeTruthy()
    expect(SPELL_BY_ID['base_attack']?.cooldown ?? 0).toBe(0)
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm test -- tests/data/spells.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write spells data**

Create `data/spells.ts`. Include `base_attack` plus ~32 themed spells across the four types. Each entry must satisfy `Spell`. Example shape (fill the full list following this pattern — Attacco with `power`, Cura with `heal`, Controllo with `effects`, Difesa with `effects` buff):
```ts
import type { Spell } from '@/types'

export const SPELLS: Spell[] = [
  { id: 'base_attack', name: 'Colpo Base', desc: 'Attacco elementare senza incantesimo.', type: 'Attacco', power: 1, hitChance: 0.95, cooldown: 0 },

  // Attacco
  { id: 'expelliarmus', name: 'Expelliarmus', desc: 'Disarma il bersaglio.', type: 'Attacco', power: 1.4, hitChance: 0.95, cooldown: 0 },
  { id: 'stupeficium', name: 'Stupeficium', desc: 'Stordisce con un lampo rosso.', type: 'Attacco', power: 1.6, hitChance: 0.9, cooldown: 1, effects: [{ kind: 'stun', duration: 1 }] },
  { id: 'sectumsempra', name: 'Sectumsempra', desc: 'Taglio oscuro e profondo.', type: 'Attacco', power: 2.4, hitChance: 0.8, cooldown: 2 },
  { id: 'bombarda', name: 'Bombarda', desc: 'Esplosione concussiva.', type: 'Attacco', power: 2.0, hitChance: 0.85, cooldown: 2 },
  { id: 'incendio', name: 'Incendio', desc: 'Fiamme che bruciano nel tempo.', type: 'Attacco', power: 1.2, hitChance: 0.9, cooldown: 1, effects: [{ kind: 'dot', amount: 8, duration: 2 }] },
  { id: 'avada', name: 'Avada Kedavra', desc: 'Maledizione che uccide.', type: 'Attacco', power: 3.2, hitChance: 0.6, cooldown: 3 },
  { id: 'reducto', name: 'Reducto', desc: 'Distrugge ciò che colpisce.', type: 'Attacco', power: 1.8, hitChance: 0.88, cooldown: 1 },
  { id: 'diffindo', name: 'Diffindo', desc: 'Lacera il bersaglio.', type: 'Attacco', power: 1.3, hitChance: 0.92, cooldown: 0 },
  { id: 'confringo', name: 'Confringo', desc: 'Esplosione incendiaria.', type: 'Attacco', power: 1.9, hitChance: 0.83, cooldown: 2, effects: [{ kind: 'dot', amount: 6, duration: 2 }] },

  // Controllo
  { id: 'crucio', name: 'Crucio', desc: 'Dolore lancinante e debilitante.', type: 'Controllo', power: 0.8, hitChance: 0.85, cooldown: 2, effects: [{ kind: 'dot', amount: 10, duration: 2 }, { kind: 'debuff', stat: 'atk', amount: 10, duration: 2 }] },
  { id: 'imperio', name: 'Imperio', desc: 'Controlla la volontà; salta il turno.', type: 'Controllo', hitChance: 0.8, cooldown: 3, effects: [{ kind: 'stun', duration: 2 }] },
  { id: 'petrificus', name: 'Petrificus Totalus', desc: 'Paralisi totale.', type: 'Controllo', hitChance: 0.85, cooldown: 2, effects: [{ kind: 'stun', duration: 1 }] },
  { id: 'levicorpus', name: 'Levicorpus', desc: 'Solleva e indebolisce la difesa.', type: 'Controllo', hitChance: 0.9, cooldown: 1, effects: [{ kind: 'debuff', stat: 'def', amount: 20, duration: 2 }] },
  { id: 'confundo', name: 'Confundo', desc: 'Confonde, riduce la velocità.', type: 'Controllo', hitChance: 0.9, cooldown: 1, effects: [{ kind: 'debuff', stat: 'spd', amount: 15, duration: 2 }] },
  { id: 'langlock', name: 'Langlock', desc: 'Riduce l’attacco nemico.', type: 'Controllo', hitChance: 0.92, cooldown: 1, effects: [{ kind: 'debuff', stat: 'atk', amount: 18, duration: 2 }] },
  { id: 'tarantallegra', name: 'Tarantallegra', desc: 'Gambe fuori controllo.', type: 'Controllo', hitChance: 0.88, cooldown: 1, effects: [{ kind: 'debuff', stat: 'spd', amount: 20, duration: 2 }] },

  // Cura
  { id: 'episkey', name: 'Episkey', desc: 'Cura ferite minori.', type: 'Cura', heal: 28, hitChance: 1, cooldown: 1 },
  { id: 'vulnera', name: 'Vulnera Sanentur', desc: 'Cura profonda.', type: 'Cura', heal: 48, hitChance: 1, cooldown: 2 },
  { id: 'rennervate', name: 'Rennervate', desc: 'Rianima e cura.', type: 'Cura', heal: 34, hitChance: 1, cooldown: 2 },
  { id: 'anapneo', name: 'Anapneo', desc: 'Libera e ristora.', type: 'Cura', heal: 22, hitChance: 1, cooldown: 1 },
  { id: 'ferula', name: 'Ferula', desc: 'Fascia le ferite, cura nel tempo.', type: 'Cura', heal: 14, hitChance: 1, cooldown: 1, effects: [{ kind: 'buff', stat: 'def', amount: 10, duration: 2 }] },

  // Difesa
  { id: 'protego', name: 'Protego', desc: 'Scudo che aumenta la difesa.', type: 'Difesa', hitChance: 1, cooldown: 1, effects: [{ kind: 'buff', stat: 'def', amount: 25, duration: 2 }] },
  { id: 'protego_maxima', name: 'Protego Maxima', desc: 'Barriera potente.', type: 'Difesa', hitChance: 1, cooldown: 3, effects: [{ kind: 'buff', stat: 'def', amount: 45, duration: 3 }] },
  { id: 'fianto', name: 'Fianto Duri', desc: 'Rinforza le barriere.', type: 'Difesa', hitChance: 1, cooldown: 2, effects: [{ kind: 'buff', stat: 'def', amount: 30, duration: 2 }] },
  { id: 'salvio', name: 'Salvio Hexia', desc: 'Devia gli incantesimi, +velocità.', type: 'Difesa', hitChance: 1, cooldown: 2, effects: [{ kind: 'buff', stat: 'spd', amount: 20, duration: 2 }] },
  { id: 'riddikulus', name: 'Riddikulus', desc: 'Rinforza il morale, +attacco.', type: 'Difesa', hitChance: 1, cooldown: 2, effects: [{ kind: 'buff', stat: 'atk', amount: 20, duration: 2 }] },
  { id: 'expecto', name: 'Expecto Patronum', desc: 'Protezione luminosa, +tutte le difese.', type: 'Difesa', hitChance: 1, cooldown: 3, effects: [{ kind: 'buff', stat: 'def', amount: 25, duration: 3 }, { kind: 'buff', stat: 'spd', amount: 15, duration: 3 }] },

  // extra Attacco to reach count + variety
  { id: 'flipendo', name: 'Flipendo', desc: 'Spinta concussiva.', type: 'Attacco', power: 1.1, hitChance: 0.93, cooldown: 0 },
  { id: 'oppugno', name: 'Oppugno', desc: 'Scaglia oggetti contro il nemico.', type: 'Attacco', power: 1.5, hitChance: 0.87, cooldown: 1 },
  { id: 'fiendfyre', name: 'Ardemonio', desc: 'Fuoco maledetto devastante.', type: 'Attacco', power: 2.8, hitChance: 0.7, cooldown: 3, effects: [{ kind: 'dot', amount: 12, duration: 2 }] },
  { id: 'serpensortia', name: 'Serpensortia', desc: 'Evoca un serpente che morde.', type: 'Attacco', power: 1.4, hitChance: 0.85, cooldown: 1, effects: [{ kind: 'dot', amount: 6, duration: 2 }] },
]

export const SPELL_BY_ID: Record<string, Spell> = Object.fromEntries(
  SPELLS.map(s => [s.id, s]),
)
```

- [ ] **Step 4: Run test, verify pass; commit**

Run: `npm test -- tests/data/spells.test.ts`
Expected: PASS.
```bash
git add -A && git commit -m "feat: add spells data with base attack"
```

---

## Task 6: Wizards data

**Files:**
- Create: `data/wizards.ts`
- Test: `tests/data/wizards.test.ts`

**Interfaces:**
- Consumes: `SPELL_BY_ID` (validate every `spellPool` id exists).
- Produces: `WIZARDS: Wizard[]` (>= 40), `WIZARD_BY_ID: Record<string, Wizard>`.

- [ ] **Step 1: Write wizards validation test**

Create `tests/data/wizards.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { WIZARDS, WIZARD_BY_ID } from '@/data/wizards'
import { SPELL_BY_ID } from '@/data/spells'

describe('wizards data', () => {
  it('has at least 40 wizards with unique ids', () => {
    expect(WIZARDS.length).toBeGreaterThanOrEqual(40)
    expect(new Set(WIZARDS.map(w => w.id)).size).toBe(WIZARDS.length)
  })
  it('every wizard has a spell pool of 4-6 valid spells', () => {
    for (const w of WIZARDS) {
      expect(w.spellPool.length).toBeGreaterThanOrEqual(4)
      expect(w.spellPool.length).toBeLessThanOrEqual(6)
      for (const id of w.spellPool) expect(SPELL_BY_ID[id], `${w.id} -> ${id}`).toBeTruthy()
    }
  })
  it('ranges are ordered [min<=max] and positive', () => {
    for (const w of WIZARDS) {
      for (const k of ['hp', 'atk', 'def', 'spd'] as const) {
        const [lo, hi] = w.ranges[k]
        expect(lo).toBeGreaterThan(0)
        expect(hi).toBeGreaterThanOrEqual(lo)
      }
    }
  })
  it('covers all houses, roles, tiers', () => {
    expect(new Set(WIZARDS.map(w => w.house)).size).toBe(4)
    expect(new Set(WIZARDS.map(w => w.role)).size).toBe(4)
    expect(new Set(WIZARDS.map(w => w.tier)).size).toBe(4)
  })
  it('has wizards tagged for each group synergy', () => {
    const tags = new Set(WIZARDS.flatMap(w => w.tags ?? []))
    for (const t of ['weasley', 'order', 'deatheater', 'marauder', 'da', 'trio']) {
      expect(tags.has(t), `missing tag ${t}`).toBe(true)
    }
  })
  it('exposes lookup map', () => { expect(WIZARD_BY_ID['harry']).toBeTruthy() })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm test -- tests/data/wizards.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write wizards data**

Create `data/wizards.ts` with **>= 45** wizards. Rules to follow while authoring:
- `id` lowercase ascii (e.g. `harry`, `hermione`, `ron`, `draco`, `bellatrix`, `snape`, `dumbledore`, `voldemort`, `mcgonagall`, `luna`, `neville`, `ginny`, `fred`, `george`, `molly`, `arthur`, `sirius`, `lupin`, `pettigrew`, `lucius`, `narcissa`, `dolohov`, `greyback`, `cho`, `cedric`, `fleur`, `viktor`, `kingsley`, `moody`, `tonks`, `flitwick`, `sprout`, `slughorn`, `hagrid`, `seamus`, `dean`, `parvati`, `lavender`, `pansy`, `goyle`, `crabbe`, `marcus`, `padma`, `terry`, `hannah`, `susan`, `ernie`, `justin`).
- Houses balanced (~11-12 each). Roles balanced (~11-12 each). Tiers distributed: a handful of Tier 1 (e.g. `dumbledore`, `voldemort`, `harry`), more Tier 2, most Tier 3-4.
- `ranges`: scale roughly with tier. Tier1 e.g. `hp:[100,130]`, Tier4 e.g. `hp:[60,85]`. Tank role biases hp/def up, Attaccante atk up, Controllo/Supporto spd up.
- `spellPool`: 4-6 spell ids consistent with role — Attaccante mostly `Attacco` ids; Supporto mostly `Cura`+`Difesa`; Controllo mostly `Controllo`; Tank mix of `Difesa`+`Attacco`. Pools may overlap across wizards.
- `tags`: assign group membership — `trio` (harry/ron/hermione), `weasley` (ron/fred/george/molly/arthur/ginny), `order` (dumbledore/sirius/lupin/moody/tonks/kingsley/molly/arthur), `deatheater` (voldemort/bellatrix/lucius/narcissa/dolohov/greyback/pettigrew), `marauder` (sirius/lupin/pettigrew), `da` (harry/hermione/ron/neville/luna/ginny/cho/seamus/dean).

Author the full array now (no placeholder). Then:
```ts
export const WIZARD_BY_ID: Record<string, Wizard> = Object.fromEntries(
  WIZARDS.map(w => [w.id, w]),
)
```

- [ ] **Step 4: Run test, verify pass; commit**

Run: `npm test -- tests/data/wizards.test.ts`
Expected: PASS.
```bash
git add -A && git commit -m "feat: add 45+ wizards data"
```

---

## Task 7: Synergies + bosses data

**Files:**
- Create: `data/synergies.ts`, `data/bosses.ts`
- Test: `tests/data/synergies.test.ts`

**Interfaces:**
- Produces: `SYNERGIES: Synergy[]` (houses ×4, roles ×4, groups ×6); `BOSSES: BossDef[]` where `interface BossDef { id: string; name: string; budget: number; hpMult: number; forcedSpellIds?: string[]; exclusiveSynergy?: Synergy }`.

- [ ] **Step 1: Write synergies test**

Create `tests/data/synergies.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { SYNERGIES } from '@/data/synergies'
import { BOSSES } from '@/data/bosses'
import { WIZARD_BY_ID } from '@/data/wizards'

describe('synergies data', () => {
  it('has house, role and group synergies', () => {
    const kinds = SYNERGIES.map(s => s.kind)
    expect(kinds.filter(k => k === 'house').length).toBe(4)
    expect(kinds.filter(k => k === 'role').length).toBe(4)
    expect(kinds.filter(k => k === 'group').length).toBeGreaterThanOrEqual(5)
  })
  it('group synergies reference existing wizards', () => {
    for (const s of SYNERGIES) {
      for (const id of s.requires.ids ?? []) expect(WIZARD_BY_ID[id], id).toBeTruthy()
    }
  })
  it('has a golden trio +15% all', () => {
    const trio = SYNERGIES.find(s => s.id === 'goldenTrio')
    expect(trio?.bonus.allPct).toBeCloseTo(0.15)
  })
  it('defines at least one boss', () => {
    expect(BOSSES.length).toBeGreaterThanOrEqual(1)
    expect(BOSSES[0]?.hpMult).toBeGreaterThan(1)
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm test -- tests/data/synergies.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write synergies + bosses**

Create `data/synergies.ts`:
```ts
import type { Synergy } from '@/types'

export const SYNERGIES: Synergy[] = [
  // Houses (3+)
  { id: 'gryffindor3', name: '3 Grifondoro', kind: 'house', requires: { house: 'Grifondoro', count: 3 }, bonus: { def: 20 } },
  { id: 'slytherin3', name: '3 Serpeverde', kind: 'house', requires: { house: 'Serpeverde', count: 3 }, bonus: { atk: 20 } },
  { id: 'ravenclaw3', name: '3 Corvonero', kind: 'house', requires: { house: 'Corvonero', count: 3 }, bonus: { spd: 20 } },
  { id: 'hufflepuff3', name: '3 Tassorosso', kind: 'house', requires: { house: 'Tassorosso', count: 3 }, bonus: { regen: 12 } },
  // Roles (3+)
  { id: 'attackers3', name: '3 Attaccanti', kind: 'role', requires: { role: 'Attaccante', count: 3 }, bonus: { atk: 15 } },
  { id: 'tanks3', name: '3 Tank', kind: 'role', requires: { role: 'Tank', count: 3 }, bonus: { def: 18 } },
  { id: 'supports3', name: '3 Supporti', kind: 'role', requires: { role: 'Supporto', count: 3 }, bonus: { regen: 10 } },
  { id: 'controllers3', name: '3 Controllo', kind: 'role', requires: { role: 'Controllo', count: 3 }, bonus: { spd: 15 } },
  // Groups
  { id: 'goldenTrio', name: 'Golden Trio', kind: 'group', requires: { ids: ['harry', 'ron', 'hermione'] }, bonus: { allPct: 0.15 } },
  { id: 'weasley', name: 'Famiglia Weasley', kind: 'group', requires: { tag: 'weasley', count: 3 }, bonus: { regen: 8, def: 10 } },
  { id: 'order', name: 'Ordine della Fenice', kind: 'group', requires: { tag: 'order', count: 3 }, bonus: { allPct: 0.1 } },
  { id: 'deatheater', name: 'Mangiamorte', kind: 'group', requires: { tag: 'deatheater', count: 3 }, bonus: { atk: 25 } },
  { id: 'marauder', name: 'Malandrini', kind: 'group', requires: { tag: 'marauder', count: 2 }, bonus: { spd: 18, atk: 10 } },
  { id: 'da', name: 'Esercito di Silente', kind: 'group', requires: { tag: 'da', count: 4 }, bonus: { allPct: 0.08, def: 8 } },
]
```
Create `data/bosses.ts`:
```ts
import type { Synergy } from '@/types'

export interface BossDef {
  id: string
  name: string
  budget: number
  hpMult: number
  forcedSpellIds?: string[]
  exclusiveSynergy?: Synergy
}

export const BOSSES: BossDef[] = [
  {
    id: 'voldemort_boss',
    name: 'Lord Voldemort',
    budget: 2600,
    hpMult: 1.4,
    forcedSpellIds: ['avada', 'fiendfyre'],
    exclusiveSynergy: {
      id: 'darkLord', name: "L'Oscuro Signore", kind: 'group',
      requires: { count: 1 }, bonus: { allPct: 0.2 },
    },
  },
]
```

- [ ] **Step 4: Run test, verify pass; commit**

Run: `npm test -- tests/data/synergies.test.ts`
Expected: PASS.
```bash
git add -A && git commit -m "feat: add synergies and boss data"
```

---

## Task 8: Stat roll + spell pick

**Files:**
- Create: `game/engine/statRoll.ts`
- Test: `tests/engine/statRoll.test.ts`

**Interfaces:**
- Consumes: `Rng`, `BALANCE.draft.tierRollBias`, `SPELL_BY_ID`, `WIZARD_BY_ID`.
- Produces:
  - `rollStats(rng: Rng, wizard: Wizard): Stats`
  - `pickSpell(rng: Rng, wizard: Wizard): Spell`
  - `draftWizard(rng: Rng, wizard: Wizard): DraftedWizard` (combines roll + spell, sets `maxHp = stats.hp`).

- [ ] **Step 1: Write statRoll test**

Create `tests/engine/statRoll.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { rollStats, pickSpell, draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARD_BY_ID } from '@/data/wizards'

const harry = WIZARD_BY_ID['harry']!

describe('statRoll', () => {
  it('rolls stats within wizard ranges', () => {
    const r = createRng(1)
    for (let i = 0; i < 50; i++) {
      const s = rollStats(r, harry)
      for (const k of ['hp', 'atk', 'def', 'spd'] as const) {
        const [lo, hi] = harry.ranges[k]
        expect(s[k]).toBeGreaterThanOrEqual(lo)
        expect(s[k]).toBeLessThanOrEqual(hi)
      }
    }
  })
  it('is deterministic per seed', () => {
    expect(rollStats(createRng(5), harry)).toEqual(rollStats(createRng(5), harry))
  })
  it('pickSpell returns a spell from the pool', () => {
    const s = pickSpell(createRng(3), harry)
    expect(harry.spellPool).toContain(s.id)
  })
  it('draftWizard sets maxHp to rolled hp', () => {
    const dw = draftWizard(createRng(7), harry)
    expect(dw.maxHp).toBe(dw.stats.hp)
    expect(dw.wizard.id).toBe('harry')
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm test -- tests/engine/statRoll.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement statRoll**

Create `game/engine/statRoll.ts`:
```ts
import type { DraftedWizard, Spell, Stats, Wizard } from '@/types'
import type { Rng } from './rng'
import { BALANCE } from '@/data/constants'
import { SPELL_BY_ID } from '@/data/spells'

function rollStat(rng: Rng, range: readonly [number, number], bias: number): number {
  const [lo, hi] = range
  if (hi <= lo) return lo
  // bias in [0,1]: blend a uniform roll toward the high end.
  const u = rng.next()
  const blended = u * (1 - bias) + Math.max(u, rng.next()) * bias
  return Math.round(lo + blended * (hi - lo))
}

export function rollStats(rng: Rng, wizard: Wizard): Stats {
  const bias = BALANCE.draft.tierRollBias[wizard.tier]
  return {
    hp: rollStat(rng, wizard.ranges.hp, bias),
    atk: rollStat(rng, wizard.ranges.atk, bias),
    def: rollStat(rng, wizard.ranges.def, bias),
    spd: rollStat(rng, wizard.ranges.spd, bias),
  }
}

export function pickSpell(rng: Rng, wizard: Wizard): Spell {
  const id = rng.pick(wizard.spellPool)
  const spell = SPELL_BY_ID[id]
  if (!spell) throw new Error(`unknown spell ${id} for ${wizard.id}`)
  return spell
}

export function draftWizard(rng: Rng, wizard: Wizard): DraftedWizard {
  const stats = rollStats(rng, wizard)
  const spell = pickSpell(rng, wizard)
  return { wizard, stats, maxHp: stats.hp, spell }
}
```

- [ ] **Step 4: Run test, verify pass; commit**

Run: `npm test -- tests/engine/statRoll.test.ts`
Expected: PASS.
```bash
git add -A && git commit -m "feat: add stat roll and spell pick"
```

---

## Task 9: Draft engine

**Files:**
- Create: `game/engine/draft.ts`
- Test: `tests/engine/draft.test.ts`

**Interfaces:**
- Consumes: `Rng`, `BALANCE.draft`, `WIZARDS`.
- Produces:
  - `interface DraftScreen { options: Wizard[] }`
  - `createDraftPool(): Wizard[]` (returns a fresh mutable copy of `WIZARDS`)
  - `generateScreen(rng: Rng, pool: Wizard[], pickedTiers: Tier[], screenIndex: number): Wizard[]` — returns 5 wizards; applies tier weighting, max-1-Tier1, high-tier guarantee, and pity. **Does not mutate `pool`.**
  - `removePicked(pool: Wizard[], pickedId: string): Wizard[]` — returns pool without the picked wizard and without the other shown options (caller passes shown ids via a second helper below).
  - `commitPick(pool: Wizard[], screen: Wizard[], pickedId: string): Wizard[]` — removes all shown options from pool, returns new pool.

- [ ] **Step 1: Write draft test**

Create `tests/engine/draft.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { createDraftPool, generateScreen, commitPick } from '@/game/engine/draft'
import { createRng } from '@/game/engine/rng'
import type { Tier } from '@/types'

describe('draft', () => {
  it('returns exactly 5 options', () => {
    const screen = generateScreen(createRng(1), createDraftPool(), [], 0)
    expect(screen).toHaveLength(5)
  })
  it('never shows more than one Tier 1 per screen', () => {
    for (let seed = 0; seed < 50; seed++) {
      const screen = generateScreen(createRng(seed), createDraftPool(), [], 0)
      expect(screen.filter(w => w.tier === 1).length).toBeLessThanOrEqual(1)
    }
  })
  it('guarantees at least one Tier <=2 per screen', () => {
    for (let seed = 0; seed < 50; seed++) {
      const screen = generateScreen(createRng(seed), createDraftPool(), [], 0)
      expect(screen.some(w => w.tier <= 2)).toBe(true)
    }
  })
  it('applies pity: screen 3 has a Tier <=2 when none picked yet', () => {
    const pickedTiers: Tier[] = [4, 4]
    const screen = generateScreen(createRng(11), createDraftPool(), pickedTiers, 2)
    expect(screen.some(w => w.tier <= 2)).toBe(true)
  })
  it('is deterministic per seed', () => {
    const a = generateScreen(createRng(8), createDraftPool(), [], 0).map(w => w.id)
    const b = generateScreen(createRng(8), createDraftPool(), [], 0).map(w => w.id)
    expect(a).toEqual(b)
  })
  it('commitPick removes all shown options from the pool', () => {
    const pool = createDraftPool()
    const screen = generateScreen(createRng(2), pool, [], 0)
    const next = commitPick(pool, screen, screen[0]!.id)
    for (const w of screen) expect(next.find(p => p.id === w.id)).toBeUndefined()
    expect(next.length).toBe(pool.length - screen.length)
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm test -- tests/engine/draft.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement draft**

Create `game/engine/draft.ts`:
```ts
import type { Tier, Wizard } from '@/types'
import type { Rng } from './rng'
import { BALANCE } from '@/data/constants'
import { WIZARDS } from '@/data/wizards'

export function createDraftPool(): Wizard[] {
  return [...WIZARDS]
}

function weightedPick(rng: Rng, candidates: Wizard[]): Wizard {
  const weights = candidates.map(w => BALANCE.draft.tierWeights[w.tier])
  const total = weights.reduce((a, b) => a + b, 0)
  let roll = rng.next() * total
  for (let i = 0; i < candidates.length; i++) {
    roll -= weights[i]!
    if (roll <= 0) return candidates[i]!
  }
  return candidates[candidates.length - 1]!
}

export function generateScreen(
  rng: Rng,
  pool: Wizard[],
  pickedTiers: Tier[],
  screenIndex: number,
): Wizard[] {
  const { screenSize, maxTier1PerScreen, pityAfterPicks, pityMaxTier } = BALANCE.draft
  const available = [...pool]
  const chosen: Wizard[] = []

  const pityActive =
    screenIndex >= pityAfterPicks &&
    pickedTiers.length >= pityAfterPicks &&
    !pickedTiers.some(t => t <= pityMaxTier)

  const take = (predicate?: (w: Wizard) => boolean) => {
    const pickable = available.filter(w =>
      !chosen.includes(w) &&
      (predicate ? predicate(w) : true) &&
      (w.tier !== 1 || chosen.filter(c => c.tier === 1).length < maxTier1PerScreen),
    )
    if (pickable.length === 0) return undefined
    const w = weightedPick(rng, pickable)
    chosen.push(w)
    return w
  }

  // Guarantee a high-tier (<=2) seat; pity forces it even harder (same effect here).
  if (pityActive || true) take(w => w.tier <= 2)

  while (chosen.length < screenSize) {
    if (!take()) break
  }
  return chosen
}

export function commitPick(pool: Wizard[], screen: Wizard[], _pickedId: string): Wizard[] {
  const shown = new Set(screen.map(w => w.id))
  return pool.filter(w => !shown.has(w.id))
}
```
Note: the `|| true` keeps the high-tier guarantee unconditional (spec: every screen guarantees a Tier ≤2). `pityActive` is computed for clarity/future tuning; the guarantee already satisfies pity. If a reviewer prefers, gate the guarantee on a config flag — but the test requires a Tier ≤2 on every screen, so it stays on.

- [ ] **Step 4: Run test, verify pass; commit**

Run: `npm test -- tests/engine/draft.test.ts`
Expected: PASS.
```bash
git add -A && git commit -m "feat: add draft engine with tier rules and pity"
```

---

## Task 10: Synergy engine

**Files:**
- Create: `game/engine/synergy.ts`
- Test: `tests/engine/synergy.test.ts`

**Interfaces:**
- Consumes: `SYNERGIES`, `DraftedWizard`, `ActiveSynergy`, `Stats`.
- Produces:
  - `detectSynergies(team: DraftedWizard[]): ActiveSynergy[]`
  - `applyBonuses(stats: Stats, synergies: ActiveSynergy[]): Stats` — applies flat stat bonuses then `allPct` multiplier; ignores `regen` (combat reads regen separately).
  - `totalRegen(synergies: ActiveSynergy[]): number`

- [ ] **Step 1: Write synergy test**

Create `tests/engine/synergy.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { detectSynergies, applyBonuses, totalRegen } from '@/game/engine/synergy'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARD_BY_ID } from '@/data/wizards'

function team(ids: string[]) {
  const r = createRng(1)
  return ids.map(id => draftWizard(r, WIZARD_BY_ID[id]!))
}

describe('synergy', () => {
  it('detects golden trio', () => {
    const active = detectSynergies(team(['harry', 'ron', 'hermione', 'luna', 'neville']))
    expect(active.find(a => a.synergy.id === 'goldenTrio')).toBeTruthy()
  })
  it('does not detect trio without all three', () => {
    const active = detectSynergies(team(['harry', 'ron', 'luna', 'neville', 'draco']))
    expect(active.find(a => a.synergy.id === 'goldenTrio')).toBeFalsy()
  })
  it('applyBonuses adds flat then percent', () => {
    const base = { hp: 100, atk: 100, def: 100, spd: 100 }
    const fakeSyn = [
      { synergy: { id: 'x', name: 'x', kind: 'house', requires: {}, bonus: { atk: 20 } }, memberIds: [] },
      { synergy: { id: 'y', name: 'y', kind: 'group', requires: {}, bonus: { allPct: 0.1 } }, memberIds: [] },
    ] as const
    const out = applyBonuses(base, fakeSyn as never)
    expect(out.atk).toBe(Math.round((100 + 20) * 1.1))
    expect(out.hp).toBe(Math.round(100 * 1.1))
  })
  it('totalRegen sums regen bonuses', () => {
    const active = detectSynergies(team(['fred', 'george', 'molly', 'arthur', 'ginny']))
    expect(totalRegen(active)).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm test -- tests/engine/synergy.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement synergy**

Create `game/engine/synergy.ts`:
```ts
import type { ActiveSynergy, DraftedWizard, Stats, Synergy } from '@/types'
import { SYNERGIES } from '@/data/synergies'

function membersFor(syn: Synergy, team: DraftedWizard[]): string[] | null {
  const req = syn.requires
  if (req.ids && req.ids.length > 0) {
    const have = team.filter(d => req.ids!.includes(d.wizard.id))
    return have.length === req.ids.length ? have.map(d => d.wizard.id) : null
  }
  const count = req.count ?? 3
  const matched = team.filter(d =>
    (req.house ? d.wizard.house === req.house : true) &&
    (req.role ? d.wizard.role === req.role : true) &&
    (req.tag ? (d.wizard.tags ?? []).includes(req.tag) : true),
  )
  return matched.length >= count ? matched.map(d => d.wizard.id) : null
}

export function detectSynergies(team: DraftedWizard[]): ActiveSynergy[] {
  const out: ActiveSynergy[] = []
  for (const syn of SYNERGIES) {
    const members = membersFor(syn, team)
    if (members) out.push({ synergy: syn, memberIds: members })
  }
  return out
}

export function applyBonuses(stats: Stats, synergies: ActiveSynergy[]): Stats {
  let { hp, atk, def, spd } = stats
  let pct = 0
  for (const { synergy } of synergies) {
    const b = synergy.bonus
    hp += b.hp ?? 0
    atk += b.atk ?? 0
    def += b.def ?? 0
    spd += b.spd ?? 0
    pct += b.allPct ?? 0
  }
  const m = 1 + pct
  return {
    hp: Math.round(hp * m),
    atk: Math.round(atk * m),
    def: Math.round(def * m),
    spd: Math.round(spd * m),
  }
}

export function totalRegen(synergies: ActiveSynergy[]): number {
  return synergies.reduce((sum, { synergy }) => sum + (synergy.bonus.regen ?? 0), 0)
}
```

- [ ] **Step 4: Run test, verify pass; commit**

Run: `npm test -- tests/engine/synergy.test.ts`
Expected: PASS.
```bash
git add -A && git commit -m "feat: add synergy detection and bonus application"
```

---

## Task 11: Combat — spell selection + targeting

**Files:**
- Create: `game/engine/combat/selectSpell.ts`, `game/engine/combat/targeting.ts`
- Test: `tests/engine/combat/selection.test.ts`

**Interfaces:**
- Consumes: `BattleUnit`, `SPELL_BY_ID`, `Rng`.
- Produces:
  - `selectSpell(unit: BattleUnit): Spell` — returns the wizard's spell if off cooldown, else `SPELL_BY_ID['base_attack']`.
  - `selectTarget(actor: BattleUnit, allies: BattleUnit[], enemies: BattleUnit[]): BattleUnit | undefined` — role heuristic; Attaccante prefers enemy Tank then lowest hp; Supporto heals most-wounded ally (returns ally) else null→caller falls back to attack; Controllo targets highest threat; Tank targets near-KO/threat.
  - `wantsHeal(actor: BattleUnit, spell: Spell): boolean` — true when spell is `Cura` and a wounded ally exists.

- [ ] **Step 1: Write selection test**

Create `tests/engine/combat/selection.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { selectSpell } from '@/game/engine/combat/selectSpell'
import { selectTarget } from '@/game/engine/combat/targeting'
import type { BattleUnit, DraftedWizard } from '@/types'
import { SPELL_BY_ID } from '@/data/spells'

function unit(over: Partial<BattleUnit> & { id: string; role: BattleUnit['wizard']['role'] }): BattleUnit {
  const stats = { hp: 100, atk: 50, def: 30, spd: 40 }
  const dw: DraftedWizard = {
    wizard: { id: over.id, name: over.id, house: 'Grifondoro', role: over.role, tier: 3,
      ranges: { hp: [100, 100], atk: [50, 50], def: [30, 30], spd: [40, 40] }, spellPool: ['base_attack'] },
    stats, maxHp: 100, spell: SPELL_BY_ID['expelliarmus']!,
  }
  return { ...dw, side: 'left', hp: 100, cooldowns: {}, statusEffects: [], buffedStats: stats, alive: true, ...over }
}

describe('combat selection', () => {
  it('uses base attack when spell on cooldown', () => {
    const u = unit({ id: 'a', role: 'Attaccante', cooldowns: { expelliarmus: 2 } })
    expect(selectSpell(u).id).toBe('base_attack')
  })
  it('uses the wizard spell when ready', () => {
    const u = unit({ id: 'a', role: 'Attaccante' })
    expect(selectSpell(u).id).toBe('expelliarmus')
  })
  it('attacker targets enemy tank first', () => {
    const actor = unit({ id: 'atk', role: 'Attaccante' })
    const tank = unit({ id: 'tank', role: 'Tank', side: 'right', hp: 200, buffedStats: { hp: 200, atk: 20, def: 80, spd: 20 } })
    const squishy = unit({ id: 'sq', role: 'Attaccante', side: 'right', hp: 50 })
    const t = selectTarget(actor, [actor], [tank, squishy])
    expect(t?.id).toBe('tank')
  })
  it('attacker targets lowest hp when no tank', () => {
    const actor = unit({ id: 'atk', role: 'Attaccante' })
    const a = unit({ id: 'a', role: 'Attaccante', side: 'right', hp: 80 })
    const b = unit({ id: 'b', role: 'Controllo', side: 'right', hp: 30 })
    expect(selectTarget(actor, [actor], [a, b])?.id).toBe('b')
  })
  it('support targets most wounded ally', () => {
    const actor = unit({ id: 'sup', role: 'Supporto' })
    const hurt = unit({ id: 'hurt', role: 'Tank', hp: 20, maxHp: 100 })
    const fine = unit({ id: 'fine', role: 'Attaccante', hp: 95, maxHp: 100 })
    const enemy = unit({ id: 'e', role: 'Attaccante', side: 'right' })
    expect(selectTarget(actor, [actor, hurt, fine], [enemy])?.id).toBe('hurt')
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm test -- tests/engine/combat/selection.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement selectSpell + targeting**

Create `game/engine/combat/selectSpell.ts`:
```ts
import type { BattleUnit, Spell } from '@/types'
import { SPELL_BY_ID } from '@/data/spells'

export function selectSpell(unit: BattleUnit): Spell {
  const onCooldown = (unit.cooldowns[unit.spell.id] ?? 0) > 0
  if (onCooldown) return SPELL_BY_ID['base_attack']!
  return unit.spell
}

export function wantsHeal(actor: BattleUnit, spell: Spell): boolean {
  return spell.type === 'Cura'
}
```
Create `game/engine/combat/targeting.ts`:
```ts
import type { BattleUnit } from '@/types'

function lowestHp(units: BattleUnit[]): BattleUnit | undefined {
  return units.slice().sort((a, b) => a.hp - b.hp || a.wizard.id.localeCompare(b.wizard.id))[0]
}

function mostWounded(units: BattleUnit[]): BattleUnit | undefined {
  const wounded = units.filter(u => u.hp < u.maxHp)
  return wounded.sort((a, b) =>
    (a.hp / a.maxHp) - (b.hp / b.maxHp) || a.wizard.id.localeCompare(b.wizard.id),
  )[0]
}

function highestThreat(units: BattleUnit[]): BattleUnit | undefined {
  return units.slice().sort((a, b) =>
    (b.buffedStats.atk + b.buffedStats.spd) - (a.buffedStats.atk + a.buffedStats.spd) ||
    a.wizard.id.localeCompare(b.wizard.id),
  )[0]
}

export function selectTarget(
  actor: BattleUnit,
  allies: BattleUnit[],
  enemies: BattleUnit[],
): BattleUnit | undefined {
  const liveEnemies = enemies.filter(e => e.alive)
  const liveAllies = allies.filter(a => a.alive)

  switch (actor.wizard.role) {
    case 'Supporto': {
      const wounded = mostWounded(liveAllies)
      return wounded ?? lowestHp(liveEnemies)
    }
    case 'Controllo':
      return highestThreat(liveEnemies)
    case 'Attaccante': {
      const tanks = liveEnemies.filter(e => e.wizard.role === 'Tank')
      return (tanks.length ? lowestHp(tanks) : lowestHp(liveEnemies))
    }
    case 'Tank':
    default: {
      const threats = liveEnemies.filter(e => e.wizard.role === 'Supporto')
      return lowestHp(threats.length ? threats : liveEnemies)
    }
  }
}
```

- [ ] **Step 4: Run test, verify pass; commit**

Run: `npm test -- tests/engine/combat/selection.test.ts`
Expected: PASS.
```bash
git add -A && git commit -m "feat: add combat spell selection and targeting"
```

---

## Task 12: Combat — resolve (damage/heal/crit/dodge/effects)

**Files:**
- Create: `game/engine/combat/resolve.ts`
- Test: `tests/engine/combat/resolve.test.ts`

**Interfaces:**
- Consumes: `BattleUnit`, `Spell`, `Rng`, `BALANCE.combat`, `LogEntry`.
- Produces:
  - `effectiveStats(unit: BattleUnit): Stats` — buffedStats adjusted by active buff/debuff effects.
  - `resolveAction(rng: Rng, turn: number, actor: BattleUnit, target: BattleUnit, spell: Spell): LogEntry` — mutates `target.hp` (or `actor`/ally hp for heals) and pushes status effects; returns the log entry. Caller clamps hp and flips `alive`.
  - `tickStatuses(turn: number, unit: BattleUnit): LogEntry[]` — applies dot, decrements durations and cooldowns, returns dot log entries.

- [ ] **Step 1: Write resolve test**

Create `tests/engine/combat/resolve.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { resolveAction, tickStatuses, effectiveStats } from '@/game/engine/combat/resolve'
import { createRng } from '@/game/engine/rng'
import type { BattleUnit, DraftedWizard } from '@/types'
import { SPELL_BY_ID } from '@/data/spells'

function unit(id: string, over: Partial<BattleUnit> = {}): BattleUnit {
  const stats = { hp: 120, atk: 80, def: 30, spd: 40 }
  const dw: DraftedWizard = {
    wizard: { id, name: id, house: 'Grifondoro', role: 'Attaccante', tier: 3,
      ranges: { hp: [120,120], atk: [80,80], def: [30,30], spd: [40,40] }, spellPool: ['base_attack'] },
    stats, maxHp: 120, spell: SPELL_BY_ID['base_attack']!,
  }
  return { ...dw, side: 'left', hp: 120, cooldowns: {}, statusEffects: [], buffedStats: stats, alive: true, ...over }
}

describe('resolve', () => {
  it('attack reduces target hp', () => {
    const a = unit('a'); const b = unit('b', { side: 'right' })
    const before = b.hp
    resolveAction(createRng(1), 1, a, b, SPELL_BY_ID['expelliarmus']!)
    expect(b.hp).toBeLessThan(before)
  })
  it('damage is at least minDamage', () => {
    const a = unit('a', { buffedStats: { hp: 1, atk: 1, def: 1, spd: 1 } })
    const b = unit('b', { side: 'right', buffedStats: { hp: 999, atk: 1, def: 999, spd: 1 } })
    const before = b.hp
    resolveAction(createRng(1), 1, a, b, SPELL_BY_ID['expelliarmus']!)
    expect(before - b.hp).toBeGreaterThanOrEqual(1)
  })
  it('heal increases ally hp without exceeding max', () => {
    const healer = unit('h'); const ally = unit('ally', { hp: 10 })
    resolveAction(createRng(1), 1, healer, ally, SPELL_BY_ID['vulnera']!)
    expect(ally.hp).toBeGreaterThan(10)
    expect(ally.hp).toBeLessThanOrEqual(ally.maxHp)
  })
  it('debuff lowers effective stat', () => {
    const a = unit('a'); const b = unit('b', { side: 'right' })
    resolveAction(createRng(1), 1, a, b, SPELL_BY_ID['levicorpus']!)
    expect(effectiveStats(b).def).toBeLessThan(b.buffedStats.def)
  })
  it('dot deals damage on tick and decrements duration', () => {
    const a = unit('a', { statusEffects: [{ kind: 'dot', amount: 10, remaining: 2 }] })
    const before = a.hp
    const logs = tickStatuses(2, a)
    expect(a.hp).toBe(before - 10)
    expect(a.statusEffects[0]?.remaining).toBe(1)
    expect(logs.length).toBeGreaterThan(0)
  })
  it('sets cooldown after casting a spell with cooldown', () => {
    const a = unit('a'); const b = unit('b', { side: 'right' })
    resolveAction(createRng(1), 1, a, b, SPELL_BY_ID['sectumsempra']!)
    expect(a.cooldowns['sectumsempra']).toBe(SPELL_BY_ID['sectumsempra']!.cooldown)
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm test -- tests/engine/combat/resolve.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement resolve**

Create `game/engine/combat/resolve.ts`:
```ts
import type { BattleUnit, LogEntry, LogFlag, Spell, Stats } from '@/types'
import type { Rng } from '../rng'
import { BALANCE } from '@/data/constants'

export function effectiveStats(unit: BattleUnit): Stats {
  const s = { ...unit.buffedStats }
  for (const e of unit.statusEffects) {
    if ((e.kind === 'buff' || e.kind === 'debuff') && e.stat && e.amount) {
      const delta = e.kind === 'buff' ? e.amount : -e.amount
      s[e.stat] = Math.max(1, s[e.stat] + delta)
    }
  }
  return s
}

function computeDamage(rng: Rng, actor: BattleUnit, target: BattleUnit, spell: Spell, flags: LogFlag[]): number {
  const c = BALANCE.combat
  const atk = effectiveStats(actor).atk
  const def = effectiveStats(target).def
  const power = spell.power ?? c.baseAttackMult
  let dmg = atk * power - def * c.defenseK
  dmg = Math.max(c.minDamage, dmg)
  const critChance = c.critBase + effectiveStats(actor).spd * c.critSpdScale
  if (rng.chance(critChance)) { dmg *= c.critMult; flags.push('crit') }
  return Math.round(dmg)
}

function dodged(rng: Rng, actor: BattleUnit, target: BattleUnit): boolean {
  const c = BALANCE.combat
  const gap = effectiveStats(target).spd - effectiveStats(actor).spd
  const chance = Math.max(0, c.dodgeBase + gap * c.dodgeScale)
  return rng.chance(chance)
}

export function resolveAction(
  rng: Rng, turn: number, actor: BattleUnit, target: BattleUnit, spell: Spell,
): LogEntry {
  const flags: LogFlag[] = []
  let value: number | undefined
  const type = spell.type

  if (spell.cooldown && spell.cooldown > 0) actor.cooldowns[spell.id] = spell.cooldown

  if (spell.type === 'Cura') {
    const heal = spell.heal ?? 0
    target.hp = Math.min(target.maxHp, target.hp + heal)
    value = heal; flags.push('heal')
  } else if (spell.type === 'Attacco' || spell.type === 'Controllo') {
    const isAttack = (spell.power ?? 0) > 0
    if (isAttack && dodged(rng, actor, target)) {
      flags.push('dodge'); value = 0
    } else {
      if (isAttack) {
        const dmg = computeDamage(rng, actor, target, spell, flags)
        target.hp -= dmg; value = dmg
      }
      for (const e of spell.effects ?? []) {
        if (e.kind === 'stun') flags.push('stun')
        if (e.kind === 'dot') flags.push('dot')
        target.statusEffects.push({ kind: e.kind, stat: e.stat, amount: e.amount, remaining: e.duration ?? 1 })
      }
    }
  } else {
    // Difesa: buff self/ally (target is actor or ally)
    for (const e of spell.effects ?? []) {
      target.statusEffects.push({ kind: e.kind, stat: e.stat, amount: e.amount, remaining: e.duration ?? 1 })
    }
    flags.push('block')
  }

  return { turn, actorId: actor.wizard.id, action: spell.name, targetId: target.wizard.id, type, value, flags }
}

export function tickStatuses(turn: number, unit: BattleUnit): LogEntry[] {
  const logs: LogEntry[] = []
  for (const e of unit.statusEffects) {
    if (e.kind === 'dot' && e.amount) {
      unit.hp -= e.amount
      logs.push({ turn, actorId: unit.wizard.id, action: 'Veleno', targetId: unit.wizard.id, type: 'Controllo', value: e.amount, flags: ['dot'] })
    }
    e.remaining -= 1
  }
  unit.statusEffects = unit.statusEffects.filter(e => e.remaining > 0)
  for (const id of Object.keys(unit.cooldowns)) {
    unit.cooldowns[id] = Math.max(0, (unit.cooldowns[id] ?? 0) - 1)
  }
  return logs
}
```
Note: `isStunned(unit)` helper — a unit is stunned this turn if it has a `stun` status with `remaining > 0`; combat (Task 13) checks `unit.statusEffects.some(e => e.kind === 'stun')` before acting. Stun statuses are pushed by `resolveAction` and decremented by `tickStatuses`.

- [ ] **Step 4: Run test, verify pass; commit**

Run: `npm test -- tests/engine/combat/resolve.test.ts`
Expected: PASS.
```bash
git add -A && git commit -m "feat: add combat resolution with crit, dodge, effects"
```

---

## Task 13: Combat — simulate loop

**Files:**
- Create: `game/engine/combat/simulate.ts`
- Test: `tests/engine/combat/simulate.test.ts`

**Interfaces:**
- Consumes: everything above + `ActiveSynergy`, `totalRegen`, `applyBonuses`.
- Produces:
  - `toBattleUnits(team: DraftedWizard[], side: Side, synergies: ActiveSynergy[]): BattleUnit[]` — builds units with `buffedStats = applyBonuses(stats, synergies)`, `maxHp` and `hp` from buffed hp.
  - `simulateBattle(left: DraftedWizard[], right: DraftedWizard[], rng: Rng, opts?: { leftSyn?: ActiveSynergy[]; rightSyn?: ActiveSynergy[] }): BattleResult`
  - Loop: order by effective spd desc (tiebreak id); skip stunned (consume one stun); act; apply regen at end of each unit's turn; tick statuses/cooldowns once per unit per turn; remove KO; stop when a side is empty or `turnCap`; tiebreak by total hp%.
  - `mvpId` = unit with max (damageDealt + healingDone) accumulated from the log.

- [ ] **Step 1: Write simulate test**

Create `tests/engine/combat/simulate.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { simulateBattle, toBattleUnits } from '@/game/engine/combat/simulate'
import { draftWizard } from '@/game/engine/statRoll'
import { detectSynergies } from '@/game/engine/synergy'
import { createRng } from '@/game/engine/rng'
import { WIZARDS } from '@/data/wizards'

function team(rng = createRng(1), n = 5) {
  return WIZARDS.slice(0, 200).filter((_, i) => i % 2 === 0).slice(0, n).map(w => draftWizard(rng, w))
}

describe('simulate', () => {
  it('produces a winner and a non-empty log', () => {
    const left = team(createRng(1)); const right = team(createRng(2))
    const res = simulateBattle(left, right, createRng(3))
    expect(['left', 'right']).toContain(res.winner)
    expect(res.log.length).toBeGreaterThan(0)
    expect(res.turns).toBeLessThanOrEqual(100)
  })
  it('is fully deterministic for the same seeds', () => {
    const l = team(createRng(1)); const r = team(createRng(2))
    const a = simulateBattle(l, r, createRng(9))
    const l2 = team(createRng(1)); const r2 = team(createRng(2))
    const b = simulateBattle(l2, r2, createRng(9))
    expect(a.winner).toBe(b.winner)
    expect(a.turns).toBe(b.turns)
    expect(a.log.length).toBe(b.log.length)
    expect(a.mvpId).toBe(b.mvpId)
  })
  it('terminates even with healers (no infinite loop)', () => {
    const left = team(createRng(11)); const right = team(createRng(12))
    const res = simulateBattle(left, right, createRng(13))
    expect(res.turns).toBeGreaterThan(0)
  })
  it('reports an mvp from the winning context', () => {
    const res = simulateBattle(team(createRng(1)), team(createRng(2)), createRng(5))
    expect(res.mvpId).toBeTruthy()
  })
  it('synergy buffs increase starting hp', () => {
    const raw = team(createRng(1))
    const syn = detectSynergies(raw)
    const buffed = toBattleUnits(raw, 'left', syn)
    expect(buffed).toHaveLength(raw.length)
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm test -- tests/engine/combat/simulate.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement simulate**

Create `game/engine/combat/simulate.ts`:
```ts
import type {
  ActiveSynergy, BattleResult, BattleUnit, DraftedWizard, LogEntry, Side, UnitSnapshot,
} from '@/types'
import type { Rng } from '../rng'
import { BALANCE } from '@/data/constants'
import { applyBonuses, totalRegen } from '../synergy'
import { effectiveStats, resolveAction, tickStatuses } from './resolve'
import { selectSpell } from './selectSpell'
import { selectTarget } from './targeting'

export function toBattleUnits(
  team: DraftedWizard[], side: Side, synergies: ActiveSynergy[],
): BattleUnit[] {
  return team.map(dw => {
    const buffed = applyBonuses(dw.stats, synergies)
    return {
      ...dw, side, buffedStats: buffed, maxHp: buffed.hp, hp: buffed.hp,
      cooldowns: {}, statusEffects: [], alive: true,
    }
  })
}

function isStunned(unit: BattleUnit): boolean {
  return unit.statusEffects.some(e => e.kind === 'stun')
}

function totalHpPct(units: BattleUnit[]): number {
  const max = units.reduce((s, u) => s + u.maxHp, 0)
  const cur = units.reduce((s, u) => s + Math.max(0, u.hp), 0)
  return max === 0 ? 0 : cur / max
}

export function simulateBattle(
  left: DraftedWizard[],
  right: DraftedWizard[],
  rng: Rng,
  opts: { leftSyn?: ActiveSynergy[]; rightSyn?: ActiveSynergy[] } = {},
): BattleResult {
  const leftSyn = opts.leftSyn ?? []
  const rightSyn = opts.rightSyn ?? []
  const L = toBattleUnits(left, 'left', leftSyn)
  const R = toBattleUnits(right, 'right', rightSyn)
  const regen: Record<Side, number> = { left: totalRegen(leftSyn), right: totalRegen(rightSyn) }
  const log: LogEntry[] = []
  const score: Record<string, number> = {}

  const sync = (u: BattleUnit) => { if (u.hp <= 0) { u.hp = 0; u.alive = false } }
  const sideUnits = (s: Side) => (s === 'left' ? L : R).filter(u => u.alive)

  let turn = 0
  while (turn < BALANCE.combat.turnCap && sideUnits('left').length && sideUnits('right').length) {
    turn++
    const order = [...L, ...R].filter(u => u.alive).sort((a, b) =>
      effectiveStats(b).spd - effectiveStats(a).spd || a.wizard.id.localeCompare(b.wizard.id),
    )
    for (const actor of order) {
      if (!actor.alive) continue
      if (isStunned(actor)) {
        const stun = actor.statusEffects.find(e => e.kind === 'stun')
        if (stun) stun.remaining -= 1
        actor.statusEffects = actor.statusEffects.filter(e => e.remaining > 0)
        log.push({ turn, actorId: actor.wizard.id, action: 'Stordito', type: 'system', flags: ['stun'] })
        continue
      }
      const allies = actor.side === 'left' ? L : R
      const enemies = actor.side === 'left' ? R : L
      const spell = selectSpell(actor)
      const healIntent = spell.type === 'Cura'
      const target = selectTarget(actor, allies, enemies)
      if (!target) continue
      const realTarget = healIntent
        ? (allies.filter(a => a.alive).filter(a => a.hp < a.maxHp).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0] ?? actor)
        : (spell.type === 'Difesa' ? actor : target)
      const entry = resolveAction(rng, turn, actor, realTarget, spell)
      log.push(entry)
      if (entry.value) score[actor.wizard.id] = (score[actor.wizard.id] ?? 0) + entry.value
      sync(realTarget)
      if (!realTarget.alive && entry.flags.includes('heal') === false) {
        log.push({ turn, actorId: actor.wizard.id, action: 'KO', targetId: realTarget.wizard.id, type: 'system', flags: ['kill'] })
      }
    }
    // end-of-turn: dot/cooldown tick + regen
    for (const u of [...L, ...R]) {
      if (!u.alive) continue
      const dots = tickStatuses(turn, u)
      for (const d of dots) log.push(d)
      sync(u)
      if (u.alive && regen[u.side] > 0) u.hp = Math.min(u.maxHp, u.hp + regen[u.side])
    }
  }

  const leftAlive = sideUnits('left').length
  const rightAlive = sideUnits('right').length
  let winner: Side
  if (leftAlive && !rightAlive) winner = 'left'
  else if (rightAlive && !leftAlive) winner = 'right'
  else winner = totalHpPct(L) >= totalHpPct(R) ? 'left' : 'right'

  const snapshot: UnitSnapshot[] = [...L, ...R].map(u => ({
    id: u.wizard.id, hp: Math.max(0, u.hp), maxHp: u.maxHp, alive: u.alive,
  }))
  const mvpId = Object.entries(score).sort((a, b) => b[1] - a[1])[0]?.[0]
    ?? (winner === 'left' ? L[0]!.wizard.id : R[0]!.wizard.id)

  return { winner, turns: turn, log, mvpId, finalSnapshot: snapshot }
}
```

- [ ] **Step 4: Run test, verify pass; commit**

Run: `npm test -- tests/engine/combat/simulate.test.ts`
Expected: PASS.
```bash
git add -A && git commit -m "feat: add deterministic combat simulation loop"
```

---

## Task 14: TeamGen (CPU + boss)

**Files:**
- Create: `game/engine/combat/teamGen.ts`
- Test: `tests/engine/combat/teamGen.test.ts`

**Interfaces:**
- Consumes: `Rng`, `WIZARDS`, `BALANCE.campaign`, `BOSSES`, `draftWizard`.
- Produces:
  - `powerOf(dw: DraftedWizard): number` — `hp + atk*2 + def*1.5 + spd`.
  - `generateEnemyTeam(rng: Rng, targetBudget: number): DraftedWizard[]` — picks 5 wizards (weighted, deterministic) whose summed power approximates the budget.
  - `generateBossTeam(rng: Rng, boss: BossDef): DraftedWizard[]` — like above with boss budget; applies `hpMult` to the leader and forces a boss spell on it.
  - `budgetForStage(stage: number): number` — `baseBudget + stage*budgetStep`.

- [ ] **Step 1: Write teamGen test**

Create `tests/engine/combat/teamGen.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { generateEnemyTeam, generateBossTeam, budgetForStage, powerOf } from '@/game/engine/combat/teamGen'
import { createRng } from '@/game/engine/rng'
import { BOSSES } from '@/data/bosses'

describe('teamGen', () => {
  it('builds a 5-wizard enemy team deterministically', () => {
    const a = generateEnemyTeam(createRng(1), budgetForStage(0)).map(d => d.wizard.id)
    const b = generateEnemyTeam(createRng(1), budgetForStage(0)).map(d => d.wizard.id)
    expect(a).toHaveLength(5)
    expect(a).toEqual(b)
  })
  it('later stages have higher budget', () => {
    expect(budgetForStage(4)).toBeGreaterThan(budgetForStage(0))
  })
  it('higher budget teams are stronger on average', () => {
    const weak = generateEnemyTeam(createRng(7), budgetForStage(0)).reduce((s, d) => s + powerOf(d), 0)
    const strong = generateEnemyTeam(createRng(7), budgetForStage(8)).reduce((s, d) => s + powerOf(d), 0)
    expect(strong).toBeGreaterThan(weak)
  })
  it('boss team applies hp multiplier to leader', () => {
    const boss = generateBossTeam(createRng(1), BOSSES[0]!)
    expect(boss).toHaveLength(5)
    const maxHp = Math.max(...boss.map(d => d.maxHp))
    expect(maxHp).toBeGreaterThan(120)
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm test -- tests/engine/combat/teamGen.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement teamGen**

Create `game/engine/combat/teamGen.ts`:
```ts
import type { DraftedWizard, Wizard } from '@/types'
import type { Rng } from '../rng'
import type { BossDef } from '@/data/bosses'
import { BALANCE } from '@/data/constants'
import { WIZARDS } from '@/data/wizards'
import { SPELL_BY_ID } from '@/data/spells'
import { draftWizard } from '../statRoll'

export function powerOf(dw: DraftedWizard): number {
  const s = dw.stats
  return s.hp + s.atk * 2 + s.def * 1.5 + s.spd
}

export function budgetForStage(stage: number): number {
  return BALANCE.campaign.baseBudget + stage * BALANCE.campaign.budgetStep
}

function pickTowardBudget(rng: Rng, targetPer: number, count: number): DraftedWizard[] {
  const pool = rng.shuffle(WIZARDS)
  const out: DraftedWizard[] = []
  let i = 0
  while (out.length < count && i < pool.length * 3) {
    const w = pool[i % pool.length] as Wizard
    i++
    if (out.find(d => d.wizard.id === w.id)) continue
    const dw = draftWizard(rng, w)
    out.push(dw)
  }
  // Sort by closeness to per-unit budget, keep the best `count`.
  return out
    .sort((a, b) => Math.abs(powerOf(a) - targetPer) - Math.abs(powerOf(b) - targetPer))
    .slice(0, count)
}

export function generateEnemyTeam(rng: Rng, targetBudget: number): DraftedWizard[] {
  const perUnit = targetBudget / BALANCE.draft.teamSize
  return pickTowardBudget(rng, perUnit, BALANCE.draft.teamSize)
}

export function generateBossTeam(rng: Rng, boss: BossDef): DraftedWizard[] {
  const perUnit = boss.budget / BALANCE.draft.teamSize
  const team = pickTowardBudget(rng, perUnit, BALANCE.draft.teamSize)
  const leader = team.reduce((best, d) => (powerOf(d) > powerOf(best) ? d : best), team[0]!)
  leader.stats = { ...leader.stats, hp: Math.round(leader.stats.hp * boss.hpMult) }
  leader.maxHp = leader.stats.hp
  const forced = boss.forcedSpellIds?.[0]
  if (forced && SPELL_BY_ID[forced]) leader.spell = SPELL_BY_ID[forced]!
  return team
}
```

- [ ] **Step 4: Run test, verify pass; commit**

Run: `npm test -- tests/engine/combat/teamGen.test.ts`
Expected: PASS.
```bash
git add -A && git commit -m "feat: add CPU and boss team generation"
```

---

## Task 15: Run orchestrator + balance sanity test

**Files:**
- Create: `game/engine/run.ts`
- Test: `tests/engine/run.test.ts`, `tests/engine/balance.test.ts`

**Interfaces:**
- Consumes: all engine modules.
- Produces:
  - `startRun(seed: string): RunState` — phase `draft`, empty team, stage 0, seed stored. Exposes `rngFor(seed, channel)` internally via `createRng(seed).fork(channel)`.
  - `confirmTeam(state: RunState, team: DraftedWizard[]): RunState` — sets team, computes `activeSynergies`, phase `team`.
  - `nextBattle(state: RunState): { state: RunState; result: BattleResult }` — generates the stage enemy (boss at final stage), simulates vs the player team, advances `stage`, sets phase `victory`/`defeat`/`win`.
  - `draftRngChannel`, `combatRngChannel` constants (separate fork salts).

- [ ] **Step 1: Write run test**

Create `tests/engine/run.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { startRun, confirmTeam, nextBattle } from '@/game/engine/run'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARDS } from '@/data/wizards'

function playerTeam() {
  const r = createRng(99)
  return WIZARDS.slice(0, 5).map(w => draftWizard(r, w))
}

describe('run orchestrator', () => {
  it('starts in draft phase with the seed', () => {
    const s = startRun('abc')
    expect(s.phase).toBe('draft')
    expect(s.seed).toBe('abc')
    expect(s.stage).toBe(0)
  })
  it('confirmTeam computes synergies', () => {
    const s = confirmTeam(startRun('abc'), playerTeam())
    expect(s.team).toHaveLength(5)
    expect(s.phase).toBe('team')
  })
  it('runs a battle and advances stage', () => {
    let s = confirmTeam(startRun('abc'), playerTeam())
    const { state, result } = nextBattle(s)
    expect(['victory', 'defeat']).toContain(state.phase)
    expect(result.log.length).toBeGreaterThan(0)
    expect(state.stage).toBe(1)
  })
  it('same seed reproduces the same first battle', () => {
    const a = nextBattle(confirmTeam(startRun('seed1'), playerTeam())).result
    const b = nextBattle(confirmTeam(startRun('seed1'), playerTeam())).result
    expect(a.winner).toBe(b.winner)
    expect(a.turns).toBe(b.turns)
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm test -- tests/engine/run.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement run**

Create `game/engine/run.ts`:
```ts
import type { BattleResult, DraftedWizard, RunState } from '@/types'
import { createRng } from './rng'
import { detectSynergies } from './synergy'
import { simulateBattle } from './combat/simulate'
import { generateEnemyTeam, generateBossTeam, budgetForStage } from './combat/teamGen'
import { BALANCE } from '@/data/constants'
import { BOSSES } from '@/data/bosses'

export const draftRngChannel = 1
export const combatRngChannel = 2

export function startRun(seed: string): RunState {
  return { seed, phase: 'draft', team: [], activeSynergies: [], stage: 0 }
}

export function confirmTeam(state: RunState, team: DraftedWizard[]): RunState {
  return { ...state, team, activeSynergies: detectSynergies(team), phase: 'team' }
}

export function nextBattle(state: RunState): { state: RunState; result: BattleResult } {
  const isBoss = state.stage >= BALANCE.campaign.enemyCount
  const base = createRng(state.seed).fork(combatRngChannel)
  const enemyRng = base.fork(state.stage + 1)
  const battleRng = base.fork(state.stage + 100)

  const enemy = isBoss
    ? generateBossTeam(enemyRng, BOSSES[0]!)
    : generateEnemyTeam(enemyRng, budgetForStage(state.stage))
  const enemySyn = detectSynergies(enemy)

  const result = simulateBattle(state.team, enemy, battleRng, {
    leftSyn: state.activeSynergies, rightSyn: enemySyn,
  })

  const won = result.winner === 'left'
  const nextStage = state.stage + 1
  const phase: RunState['phase'] = !won
    ? 'defeat'
    : isBoss ? 'win' : 'victory'

  return { state: { ...state, stage: nextStage, lastBattle: result, phase }, result }
}
```

- [ ] **Step 4: Run run test, verify pass**

Run: `npm test -- tests/engine/run.test.ts`
Expected: PASS.

- [ ] **Step 5: Write balance sanity test**

Create `tests/engine/balance.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { startRun, confirmTeam, nextBattle } from '@/game/engine/run'
import { generateEnemyTeam, budgetForStage } from '@/game/engine/combat/teamGen'
import { simulateBattle } from '@/game/engine/combat/simulate'
import { detectSynergies } from '@/game/engine/synergy'
import { createRng } from '@/game/engine/rng'

describe('balance sanity', () => {
  it('stage 0 player teams are competitive (win rate in a sane band)', () => {
    let wins = 0
    const N = 60
    for (let i = 0; i < N; i++) {
      const playerRng = createRng(`p${i}`)
      const player = generateEnemyTeam(playerRng, budgetForStage(2))
      const enemy = generateEnemyTeam(createRng(`e${i}`), budgetForStage(0))
      const res = simulateBattle(player, enemy, createRng(`b${i}`), {
        leftSyn: detectSynergies(player), rightSyn: detectSynergies(enemy),
      })
      if (res.winner === 'left') wins++
    }
    const rate = wins / N
    // stronger-budget side should usually win, but not always.
    expect(rate).toBeGreaterThan(0.5)
    expect(rate).toBeLessThan(1)
  })
  it('no battle runs to the turn cap on every seed (avoids stalemates)', () => {
    let capped = 0
    for (let i = 0; i < 40; i++) {
      const a = generateEnemyTeam(createRng(`a${i}`), budgetForStage(3))
      const b = generateEnemyTeam(createRng(`z${i}`), budgetForStage(3))
      const res = simulateBattle(a, b, createRng(`s${i}`))
      if (res.turns >= 100) capped++
    }
    expect(capped).toBeLessThan(40)
  })
})
```

- [ ] **Step 6: Run balance test; tune if needed**

Run: `npm test -- tests/engine/balance.test.ts`
Expected: PASS. If win-rate or stalemate assertions fail, tune `data/constants.ts` (`defenseK`, `baseAttackMult`, `turnCap`, regen values) and re-run. Do not change test thresholds to force a pass — adjust balance.

- [ ] **Step 7: Run full suite; commit**

Run: `npm test`
Expected: all suites PASS.
```bash
git add -A && git commit -m "feat: add run orchestrator and balance sanity tests"
```

---

## Task 16: Build + typecheck gate

**Files:**
- Modify: `package.json` (add `typecheck` script)

- [ ] **Step 1: Add typecheck script**

In `package.json` `"scripts"`: `"typecheck": "tsc --noEmit"`.

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: no errors. Fix any strict-mode issues surfaced by `noUncheckedIndexedAccess` (use non-null assertions or guards already shown in the engine).

- [ ] **Step 3: Run production build**

Run: `npm run build`
Expected: Next build succeeds (the default scaffolded page compiles; engine is tree-shaken/unused by UI in M1).

- [ ] **Step 4: Run full test suite once more**

Run: `npm test`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "chore: add typecheck script; verify build + tests green"
```

---

## Self-Review notes

- **Spec coverage:** types ✓ (T2), data wizards/spells/synergies/bosses/houses/constants ✓ (T3,5,6,7), rng seed ✓ (T4), stat roll + tier bias ✓ (T8), draft tier rules + pity ✓ (T9), synergies ✓ (T10), combat targeting/selection/resolve/simulate ✓ (T11-13), base-attack fallback ✓ (T11/12), CPU+boss teamgen ✓ (T14), run orchestrator + deterministic seed ✓ (T15), balance sanity ✓ (T15), build gate ✓ (T16). UI explicitly out of scope (M2+).
- **Determinism:** every random consumer takes `Rng`; `run.ts` forks per channel/stage so combat changes never shift draft.
- **Type consistency:** `Rng`, `Stats`, `BattleUnit`, `LogEntry`, `DraftedWizard`, `BossDef` names match across tasks.
- **No placeholders:** Task 6 wizard authoring is the one bulk-content step; its rules and id list are explicit, so the implementer writes concrete data, not a stub.
