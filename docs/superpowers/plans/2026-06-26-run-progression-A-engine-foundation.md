# Run Progression — Piano A: Fondamenta del Motore (puro) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere i moduli puri che reggono il nuovo loop a nodi — progressione per livelli, reclutamento con bias-Casa, generatore intelligente di categorie e generazione mappa per-area — senza toccare il loop di run esistente.

**Architecture:** Tutti i moduli di questo piano sono **puri e additivi**. Non modificano `RunState`, `run.ts`, `useRun.ts` né il motore di combattimento. Estendono solo tipi in modo retro-compatibile (campi opzionali, union allargate) e aggiungono nuovi file con i propri test. La suite resta verde a ogni commit. L'integrazione (riscrittura di `RunState`/`run.ts`/UI/persistenza/harness) è il Piano B.

**Tech Stack:** TypeScript, Vitest, RNG deterministico esistente (`game/engine/rng.ts`).

## Global Constraints

- **Determinismo:** ogni generatore prende un `Rng` (mai `Math.random`). Stesso seed → stesso output. `Date.now()`/`Math.random()` vietati.
- **Confine di combattimento:** nessun file di questo piano importa o modifica `game/engine/combat/*`.
- **Immutabilità:** le funzioni non mutano gli input; restituiscono nuovi oggetti.
- **Stat:** `Stats = { hp, atk, def, spd }` (tutti `number`). `Stat = 'hp' | 'atk' | 'def' | 'spd'`.
- **Numeri di bilanciamento:** vivono solo in `data/constants.ts` (`BALANCE`). Niente costanti magiche nei moduli.
- **Valori iniziali:** i numeri di `BALANCE.leveling` / `BALANCE.map` / `BALANCE.recruit` sono di partenza; verranno calibrati dall'harness nel Piano B. Non inventarne altri.
- **Test runner:** `npx vitest run <path>` dalla root del progetto.
- **DraftedWizard factory:** `draftWizard(rng, wizard, allowShiny=false)` in `game/engine/statRoll.ts` produce `{ wizard, stats, maxHp, spell, shiny? }`. I campi di progressione si aggiungono DOPO, mai dentro il factory (per non sporcare le squadre nemiche).

---

## File Structure

| File | Responsabilità |
|---|---|
| `types/combat.ts` (modifica) | `DraftedWizard` += campi opzionali progressione; `GrowthChoice` |
| `types/run.ts` (modifica) | `RunNodeType` allargato; `RunNode.resolved?`; `RunEvent`; `PendingLevelUp` |
| `data/constants.ts` (modifica) | `BALANCE.leveling`, `BALANCE.recruit`, aggiunte a `BALANCE.map` |
| `game/engine/leveling.ts` (nuovo) | EXP, livelli, crescita stat, soglie |
| `game/engine/recruit.ts` (nuovo) | Terna di reclutamento (bias-Casa), provenienza, rimpiazzo |
| `game/engine/nodeGen.ts` (nuovo) | Assegnazione categorie ai nodi (regole dure + bias) |
| `game/engine/map.ts` (modifica) | `generateArea` + parser id area-aware (additivi) |
| `game/engine/nodeCatalog.ts` (nuovo) | Catalogo tipi nodo + metadati |

---

## Task 1: Tipi e costanti (additivi)

**Files:**
- Modify: `types/combat.ts` (dopo `DraftedWizard`, riga ~14)
- Modify: `types/run.ts` (intero file)
- Modify: `data/constants.ts` (oggetto `BALANCE`)
- Test: `tests/data/runConstants.test.ts` (nuovo)

**Interfaces:**
- Produces:
  - `DraftedWizard` con `level?: number`, `exp?: number`, `recruitedVia?: string`, `growthChoices?: GrowthChoice[]`
  - `interface GrowthChoice { atLevel: number; kind: 'atk' | 'def' | 'spd' | 'hp' }`
  - `RunNodeType = 'battle'|'elite'|'boss'|'recruit'|'relic'|'shop'|'event'|'commonRoom'|'library'|'potions'|'forest'`
  - `interface RunEvent { area: number; nodeId: string; kind: 'recruit'|'relic'|'elite'|'boss'|'levelMilestone'; summary: string }`
  - `interface PendingLevelUp { wizardId: string; atLevel: number }`
  - `BALANCE.leveling`, `BALANCE.recruit`, e nuove chiavi in `BALANCE.map`

- [ ] **Step 1: Estendi `DraftedWizard` e aggiungi `GrowthChoice`**

In `types/combat.ts`, sostituisci l'interfaccia `DraftedWizard` (righe 5-14) con:

```ts
export interface GrowthChoice {
  atLevel: number
  kind: 'atk' | 'def' | 'spd' | 'hp'
}

export interface DraftedWizard {
  wizard: Wizard
  stats: Stats
  maxHp: number
  spell: Spell
  /** Current HP carried across battles in a run. Absent = full (treated as maxHp). */
  currentHp?: number
  /** Rare draft "shiny" nature: grants one trait + a name epithet. Player-only. */
  shiny?: { traitId: string }
  /** Run progression (player wizards only; absent on enemy teams → treated as level 1). */
  level?: number
  exp?: number
  recruitedVia?: string
  growthChoices?: GrowthChoice[]
}
```

- [ ] **Step 2: Riscrivi `types/run.ts`**

Sostituisci l'intero `types/run.ts` con (mantiene i tipi esistenti, ne aggiunge di nuovi; NON rimuove campi da `RunState` — quello è il Piano B):

```ts
import type { ActiveSynergy, DraftedWizard, BattleResult } from './index'
import type { ActiveRelic } from './relic'

export type RunPhase =
  | 'menu' | 'draft' | 'team' | 'battle'
  | 'victory' | 'defeat' | 'win'

export type RunNodeType =
  // Fase 1 — generati e risolti
  | 'battle' | 'elite' | 'boss' | 'recruit' | 'relic'
  // Fasi 2-3 — catalogati ora, generati dopo
  | 'shop' | 'event' | 'commonRoom'
  | 'library' | 'potions' | 'forest'

export interface RunNode {
  id: string
  type: RunNodeType
  /** ids of reachable nodes (branching graph). */
  next: string[]
  /** true once the node has been completed (for save/render). */
  resolved?: boolean
}

/** Narrative log entry — seeds the Fase 4 end-of-run story screen. */
export interface RunEvent {
  area: number
  nodeId: string
  kind: 'recruit' | 'relic' | 'elite' | 'boss' | 'levelMilestone'
  summary: string
}

/** A wizard crossing a milestone level, awaiting the player's growth choice. */
export interface PendingLevelUp {
  wizardId: string
  atLevel: number
}

export interface RunState {
  seed: string
  phase: RunPhase
  team: DraftedWizard[]
  activeSynergies: ActiveSynergy[]
  stage: number
  lastBattle?: BattleResult
  relics: ActiveRelic[]
  map?: RunNode[]
  currentNodeId?: string
}
```

- [ ] **Step 3: Aggiungi le costanti in `data/constants.ts`**

Dentro l'oggetto `BALANCE`, aggiungi `leveling` e `recruit` come nuove chiavi top-level (accanto a `campaign`, `map`, …) e aggiungi le chiavi nuove dentro `map`. Inserisci `leveling` e `recruit` subito dopo il blocco `relics`:

```ts
  leveling: {
    autoGrowthPct: 0.06,        // +6% a tutte le stat per livello sopra il 1
    milestoneBoostPct: 0.25,    // +25% allo stat scelto a una soglia
    milestoneLevels: [3, 6, 9] as readonly number[],
    levelMax: 10,
    expStep: 100,               // exp per salire da L a L+1 = expStep * L
    expBattle: 60,              // exp da un combattimento normale (team-wide)
    expElite: 140,              // exp da un Elite
    expBoss: 0,                 // il boss chiude l'area: exp irrilevante
  },
  recruit: {
    offerSize: 3,
    houseGuarantee: 1,          // almeno N candidati della Casa del giocatore
    houseBiasWeight: 1.5,       // moltiplicatore di peso per i non-garantiti della Casa
  },
```

E dentro l'oggetto `map` esistente aggiungi (dopo `eliteBudgetMult`):

```ts
    areas: 3,                   // numero di aree per run
    floorsPerArea: 5,           // piani per area incl. ingresso(0) + boss(last)
    eliteMinFloor: 2,           // l'unico Elite dell'area va in [eliteMinFloor, floorsPerArea-2]
    categoryWeights: { battle: 50, recruit: 28, relic: 22 } as Record<'battle' | 'recruit' | 'relic', number>,
    recruitBiasBoost: 30,       // peso aggiunto a 'recruit' quando la squadra è incompleta
```

- [ ] **Step 4: Scrivi il test delle costanti**

Crea `tests/data/runConstants.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { BALANCE } from '@/data/constants'

describe('run progression constants', () => {
  it('leveling has sane values', () => {
    const l = BALANCE.leveling
    expect(l.levelMax).toBeGreaterThan(Math.max(...l.milestoneLevels))
    expect(l.autoGrowthPct).toBeGreaterThan(0)
    expect(l.expBattle).toBeGreaterThan(0)
    expect(l.expElite).toBeGreaterThan(l.expBattle)
  })
  it('map area config is coherent', () => {
    const m = BALANCE.map
    expect(m.areas).toBeGreaterThanOrEqual(1)
    expect(m.floorsPerArea).toBeGreaterThanOrEqual(3) // ingresso + almeno 1 medio + boss
    expect(m.eliteMinFloor).toBeGreaterThanOrEqual(1)
    expect(m.eliteMinFloor).toBeLessThanOrEqual(m.floorsPerArea - 2)
  })
  it('recruit offer is at least the house guarantee', () => {
    expect(BALANCE.recruit.offerSize).toBeGreaterThanOrEqual(BALANCE.recruit.houseGuarantee)
  })
})
```

- [ ] **Step 5: Esegui il test e il typecheck**

Run: `npx vitest run tests/data/runConstants.test.ts`
Expected: PASS (3 test)

Run: `npx tsc --noEmit`
Expected: exit 0 (i campi opzionali di `DraftedWizard` non rompono nulla)

- [ ] **Step 6: Esegui la suite completa per confermare zero regressioni**

Run: `npx vitest run`
Expected: tutti i test passano (i tipi nuovi sono additivi)

- [ ] **Step 7: Commit**

```bash
git add types/combat.ts types/run.ts data/constants.ts tests/data/runConstants.test.ts
git commit -m "feat(run): additive types + constants for leveling, recruit, area map"
```

---

## Task 2: Modulo livelli (`leveling.ts`)

**Files:**
- Create: `game/engine/leveling.ts`
- Test: `tests/engine/leveling.test.ts`

**Interfaces:**
- Consumes: `BALANCE.leveling`; `DraftedWizard` (campi `level?`, `exp?`, `stats`, `growthChoices?`); `GrowthChoice`; `Stats`.
- Produces:
  - `expForLevel(level: number): number` — soglia EXP cumulativa per ESSERE al livello `level` (livello 1 = 0)
  - `levelFromExp(exp: number): number` — livello (cap a `levelMax`) data l'EXP cumulativa
  - `isMilestone(level: number): boolean`
  - `addExp(dw: DraftedWizard, amount: number): { dw: DraftedWizard; milestones: number[] }` — exp cumulativa aggiornata, livello ricalcolato, soglie appena superate
  - `leveledStats(dw: DraftedWizard): Stats` — stat effettive (base × crescita auto + scelte-soglia), arrotondate
  - `applyGrowthChoice(dw: DraftedWizard, choice: GrowthChoice): DraftedWizard`

- [ ] **Step 1: Scrivi i test (falliscono)**

Crea `tests/engine/leveling.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { expForLevel, levelFromExp, isMilestone, addExp, leveledStats, applyGrowthChoice } from '@/game/engine/leveling'
import { BALANCE } from '@/data/constants'
import type { DraftedWizard } from '@/types'

function dw(partial: Partial<DraftedWizard> = {}): DraftedWizard {
  return {
    wizard: { id: 'x', name: 'X', house: 'Grifondoro', role: 'Attaccante', tier: 4, gender: 'm',
      ranges: { hp: [100, 100], atk: [50, 50], def: [40, 40], spd: [30, 30] }, spellPool: ['s'] },
    stats: { hp: 100, atk: 50, def: 40, spd: 30 }, maxHp: 100,
    spell: { id: 's' } as DraftedWizard['spell'],
    level: 1, exp: 0, growthChoices: [],
    ...partial,
  }
}

describe('leveling', () => {
  it('expForLevel is 0 at level 1 and strictly increasing', () => {
    expect(expForLevel(1)).toBe(0)
    expect(expForLevel(2)).toBeGreaterThan(expForLevel(1))
    expect(expForLevel(3)).toBeGreaterThan(expForLevel(2))
  })
  it('levelFromExp inverts expForLevel and caps at levelMax', () => {
    expect(levelFromExp(0)).toBe(1)
    expect(levelFromExp(expForLevel(3))).toBe(3)
    expect(levelFromExp(expForLevel(3) - 1)).toBe(2)
    expect(levelFromExp(10_000_000)).toBe(BALANCE.leveling.levelMax)
  })
  it('isMilestone matches configured levels', () => {
    expect(isMilestone(3)).toBe(true)
    expect(isMilestone(4)).toBe(false)
  })
  it('addExp bumps level and reports newly crossed milestones', () => {
    const r = addExp(dw({ level: 1, exp: 0 }), expForLevel(3))
    expect(r.dw.level).toBe(3)
    expect(r.dw.exp).toBe(expForLevel(3))
    expect(r.milestones).toContain(3)
  })
  it('addExp does not re-report an already-passed milestone', () => {
    const at3 = addExp(dw({ level: 1, exp: 0 }), expForLevel(3)).dw
    const r = addExp(at3, expForLevel(4) - expForLevel(3))
    expect(r.dw.level).toBe(4)
    expect(r.milestones).not.toContain(3)
  })
  it('leveledStats grows with level', () => {
    const lo = leveledStats(dw({ level: 1 }))
    const hi = leveledStats(dw({ level: 5 }))
    expect(hi.atk).toBeGreaterThan(lo.atk)
    expect(lo.atk).toBe(50) // livello 1 = stat base
  })
  it('leveledStats treats missing level as 1', () => {
    expect(leveledStats(dw({ level: undefined }))).toEqual({ hp: 100, atk: 50, def: 40, spd: 30 })
  })
  it('applyGrowthChoice boosts the chosen stat', () => {
    const grown = applyGrowthChoice(dw({ level: 3 }), { atLevel: 3, kind: 'atk' })
    expect(grown.growthChoices).toHaveLength(1)
    expect(leveledStats(grown).atk).toBeGreaterThan(leveledStats(dw({ level: 3 })).atk)
  })
})
```

- [ ] **Step 2: Esegui i test per verificare che falliscano**

Run: `npx vitest run tests/engine/leveling.test.ts`
Expected: FAIL ("does not provide an export named 'expForLevel'")

- [ ] **Step 3: Implementa `leveling.ts`**

Crea `game/engine/leveling.ts`:

```ts
import type { DraftedWizard, GrowthChoice, Stats } from '@/types'
import { BALANCE } from '@/data/constants'

const L = BALANCE.leveling

/** Cumulative EXP required to BE at `level`. Level 1 = 0. Step grows linearly. */
export function expForLevel(level: number): number {
  const n = Math.max(1, Math.floor(level))
  // sum_{k=1}^{n-1} expStep*k = expStep * (n-1)*n/2
  return L.expStep * ((n - 1) * n) / 2
}

export function levelFromExp(exp: number): number {
  let lvl = 1
  while (lvl < L.levelMax && exp >= expForLevel(lvl + 1)) lvl++
  return lvl
}

export function isMilestone(level: number): boolean {
  return L.milestoneLevels.includes(level)
}

export function addExp(dw: DraftedWizard, amount: number): { dw: DraftedWizard; milestones: number[] } {
  const oldLevel = dw.level ?? 1
  const newExp = (dw.exp ?? 0) + Math.max(0, amount)
  const newLevel = levelFromExp(newExp)
  const milestones: number[] = []
  for (let lv = oldLevel + 1; lv <= newLevel; lv++) {
    if (isMilestone(lv)) milestones.push(lv)
  }
  return { dw: { ...dw, exp: newExp, level: newLevel }, milestones }
}

/** Effective stats: base × auto-growth, then each milestone growth choice boosts its stat. */
export function leveledStats(dw: DraftedWizard): Stats {
  const level = dw.level ?? 1
  const growth = 1 + L.autoGrowthPct * (level - 1)
  const out: Stats = {
    hp: dw.stats.hp * growth,
    atk: dw.stats.atk * growth,
    def: dw.stats.def * growth,
    spd: dw.stats.spd * growth,
  }
  for (const c of dw.growthChoices ?? []) {
    out[c.kind] *= 1 + L.milestoneBoostPct
  }
  return { hp: Math.round(out.hp), atk: Math.round(out.atk), def: Math.round(out.def), spd: Math.round(out.spd) }
}

export function applyGrowthChoice(dw: DraftedWizard, choice: GrowthChoice): DraftedWizard {
  return { ...dw, growthChoices: [...(dw.growthChoices ?? []), choice] }
}
```

- [ ] **Step 4: Esegui i test**

Run: `npx vitest run tests/engine/leveling.test.ts`
Expected: PASS (8 test)

- [ ] **Step 5: Commit**

```bash
git add game/engine/leveling.ts tests/engine/leveling.test.ts
git commit -m "feat(run): leveling module — exp curve, milestones, leveled stats"
```

---

## Task 3: Modulo reclutamento (`recruit.ts`)

**Files:**
- Create: `game/engine/recruit.ts`
- Test: `tests/engine/recruit.test.ts`

**Interfaces:**
- Consumes: `Rng`; `createDraftPool()` da `./draft`; `draftWizard` da `./statRoll`; `BALANCE.recruit`, `BALANCE.draft.tierWeights`; `House`, `Wizard`, `DraftedWizard`.
- Produces:
  - `offerRecruits(rng: Rng, opts: { house: House; exclude: ReadonlySet<string> }): DraftedWizard[]` — esattamente `BALANCE.recruit.offerSize` candidati distinti, ≥`houseGuarantee` della Casa, nessuno in `exclude`
  - `recruitVia(dw: DraftedWizard, via: string): DraftedWizard` — imposta `recruitedVia` + inizializza `level:1, exp:0, growthChoices:[]`
  - `replaceMember(team: DraftedWizard[], outId: string, incoming: DraftedWizard): DraftedWizard[]`

- [ ] **Step 1: Scrivi i test (falliscono)**

Crea `tests/engine/recruit.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { offerRecruits, recruitVia, replaceMember } from '@/game/engine/recruit'
import { createRng } from '@/game/engine/rng'
import { BALANCE } from '@/data/constants'
import type { DraftedWizard } from '@/types'

describe('recruit', () => {
  it('offers exactly offerSize distinct candidates', () => {
    for (let s = 0; s < 30; s++) {
      const offer = offerRecruits(createRng(s), { house: 'Tassorosso', exclude: new Set() })
      expect(offer).toHaveLength(BALANCE.recruit.offerSize)
      expect(new Set(offer.map(o => o.wizard.id)).size).toBe(offer.length)
    }
  })
  it('guarantees at least houseGuarantee of the chosen house', () => {
    for (let s = 0; s < 30; s++) {
      const offer = offerRecruits(createRng(s), { house: 'Serpeverde', exclude: new Set() })
      const fromHouse = offer.filter(o => o.wizard.house === 'Serpeverde').length
      expect(fromHouse).toBeGreaterThanOrEqual(BALANCE.recruit.houseGuarantee)
    }
  })
  it('never offers an excluded wizard', () => {
    const excludeId = offerRecruits(createRng(1), { house: 'Corvonero', exclude: new Set() })[0]!.wizard.id
    for (let s = 0; s < 30; s++) {
      const offer = offerRecruits(createRng(s), { house: 'Corvonero', exclude: new Set([excludeId]) })
      expect(offer.some(o => o.wizard.id === excludeId)).toBe(false)
    }
  })
  it('is deterministic per seed', () => {
    const a = offerRecruits(createRng(7), { house: 'Grifondoro', exclude: new Set() }).map(o => o.wizard.id)
    const b = offerRecruits(createRng(7), { house: 'Grifondoro', exclude: new Set() }).map(o => o.wizard.id)
    expect(a).toEqual(b)
  })
  it('recruitVia sets provenance and initializes progression', () => {
    const base = offerRecruits(createRng(2), { house: 'Tassorosso', exclude: new Set() })[0]!
    const r = recruitVia(base, 'Elite')
    expect(r.recruitedVia).toBe('Elite')
    expect(r.level).toBe(1)
    expect(r.exp).toBe(0)
    expect(r.growthChoices).toEqual([])
  })
  it('replaceMember swaps the targeted member, preserving order length', () => {
    const team = offerRecruits(createRng(3), { house: 'Grifondoro', exclude: new Set() })
    const incoming = offerRecruits(createRng(99), { house: 'Serpeverde', exclude: new Set(team.map(t => t.wizard.id)) })[0]!
    const out = replaceMember(team, team[1]!.wizard.id, incoming)
    expect(out).toHaveLength(team.length)
    expect(out.some(t => t.wizard.id === team[1]!.wizard.id)).toBe(false)
    expect(out.some(t => t.wizard.id === incoming.wizard.id)).toBe(true)
  })
})
```

- [ ] **Step 2: Esegui i test per verificare che falliscano**

Run: `npx vitest run tests/engine/recruit.test.ts`
Expected: FAIL ("does not provide an export named 'offerRecruits'")

- [ ] **Step 3: Implementa `recruit.ts`**

Crea `game/engine/recruit.ts`:

```ts
import type { DraftedWizard, House, Wizard } from '@/types'
import type { Rng } from './rng'
import { createDraftPool } from './draft'
import { draftWizard } from './statRoll'
import { BALANCE } from '@/data/constants'

/** Weighted pick by tier (rarer tiers are less likely), removing the pick from the list. */
function takeWeighted(rng: Rng, pool: Wizard[]): Wizard {
  const weights = pool.map(w => BALANCE.draft.tierWeights[w.tier])
  const total = weights.reduce((a, b) => a + b, 0)
  let roll = rng.next() * total
  let idx = pool.length - 1
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i]!
    if (roll <= 0) { idx = i; break }
  }
  return pool.splice(idx, 1)[0]!
}

/**
 * Build a recruitment offer: `offerSize` distinct candidates, at least
 * `houseGuarantee` from the player's house, none in `exclude`. House members
 * get a mild weight bias (`houseBiasWeight`) among the non-guaranteed picks.
 */
export function offerRecruits(
  rng: Rng,
  opts: { house: House; exclude: ReadonlySet<string> },
): DraftedWizard[] {
  const { offerSize, houseGuarantee, houseBiasWeight } = BALANCE.recruit
  const available = createDraftPool().filter(w => !opts.exclude.has(w.id))
  const chosen: Wizard[] = []

  // 1. Guaranteed house members (tier-weighted among the house pool).
  for (let g = 0; g < houseGuarantee; g++) {
    const housePool = available.filter(w => w.house === opts.house && !chosen.includes(w))
    if (housePool.length === 0) break
    chosen.push(takeWeighted(rng, [...housePool]))
  }

  // 2. Fill the rest from everyone left, with a mild house bias.
  while (chosen.length < offerSize) {
    const rest = available.filter(w => !chosen.includes(w))
    if (rest.length === 0) break
    chosen.push(pickBiased(rng, rest, opts.house, houseBiasWeight))
  }

  // 3. Roll each into a DraftedWizard (player draft → shiny allowed).
  return chosen.map(w => draftWizard(rng, w, true))
}

/** Tier-weighted pick with an extra multiplier for the player's house. Non-mutating. */
function pickBiased(rng: Rng, pool: Wizard[], house: House, houseBias: number): Wizard {
  const weights = pool.map(w => BALANCE.draft.tierWeights[w.tier] * (w.house === house ? houseBias : 1))
  const total = weights.reduce((a, b) => a + b, 0)
  let roll = rng.next() * total
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i]!
    if (roll <= 0) return pool[i]!
  }
  return pool[pool.length - 1]!
}

export function recruitVia(dw: DraftedWizard, via: string): DraftedWizard {
  return { ...dw, recruitedVia: via, level: 1, exp: 0, growthChoices: [] }
}

export function replaceMember(
  team: DraftedWizard[], outId: string, incoming: DraftedWizard,
): DraftedWizard[] {
  return team.map(m => (m.wizard.id === outId ? incoming : m))
}
```

- [ ] **Step 4: Esegui i test**

Run: `npx vitest run tests/engine/recruit.test.ts`
Expected: PASS (6 test)

- [ ] **Step 5: Typecheck e suite completa**

Run: `npx tsc --noEmit`
Expected: exit 0

Run: `npx vitest run`
Expected: tutti i test passano

- [ ] **Step 6: Commit**

```bash
git add game/engine/recruit.ts tests/engine/recruit.test.ts
git commit -m "feat(run): recruit module — house-biased offer, provenance, replace"
```

---

## Task 4: Generatore di categorie (`nodeGen.ts`)

**Files:**
- Create: `game/engine/nodeGen.ts`
- Test: `tests/engine/nodeGen.test.ts`

**Interfaces:**
- Consumes: `Rng`; `BALANCE.map` (`eliteMinFloor`, `categoryWeights`, `recruitBiasBoost`); `RunNodeType`.
- Produces:
  - `interface AreaBias { teamSize: number; teamMax: number }`
  - `assignAreaCategories(rng: Rng, widths: number[], bias: AreaBias): RunNodeType[][]` — per ogni piano un array di categorie. Garantisce: piano 0 = `['battle']`; ultimo piano = `['boss']`; esattamente 1 `elite` totale (in un piano in `[eliteMinFloor, len-2]`); ≥1 `recruit` e ≥1 `relic` tra i nodi medi.

- [ ] **Step 1: Scrivi i test (falliscono)**

Crea `tests/engine/nodeGen.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { assignAreaCategories } from '@/game/engine/nodeGen'
import { createRng } from '@/game/engine/rng'
import { BALANCE } from '@/data/constants'

const widths = () => {
  // 5 floors: [1, 2, 3, 2, 1] (ingresso, medi, boss)
  return [1, 2, 3, 2, 1]
}
const flat = (cats: string[][]) => cats.flat()
const bias = { teamSize: 5, teamMax: 5 }

describe('assignAreaCategories', () => {
  it('floor 0 is battle, last floor is boss', () => {
    const cats = assignAreaCategories(createRng(1), widths(), bias)
    expect(cats[0]).toEqual(['battle'])
    expect(cats[cats.length - 1]).toEqual(['boss'])
  })
  it('matches the input widths', () => {
    const w = widths()
    const cats = assignAreaCategories(createRng(2), w, bias)
    expect(cats.map(f => f.length)).toEqual(w)
  })
  it('places exactly one elite, within the allowed floor band', () => {
    for (let s = 0; s < 40; s++) {
      const w = widths()
      const cats = assignAreaCategories(createRng(s), w, bias)
      expect(flat(cats).filter(c => c === 'elite')).toHaveLength(1)
      const eliteFloor = cats.findIndex(f => f.includes('elite'))
      expect(eliteFloor).toBeGreaterThanOrEqual(BALANCE.map.eliteMinFloor)
      expect(eliteFloor).toBeLessThanOrEqual(w.length - 2)
    }
  })
  it('guarantees at least one recruit and one relic among middle nodes', () => {
    for (let s = 0; s < 40; s++) {
      const cats = flat(assignAreaCategories(createRng(s), widths(), bias))
      expect(cats.filter(c => c === 'recruit').length).toBeGreaterThanOrEqual(1)
      expect(cats.filter(c => c === 'relic').length).toBeGreaterThanOrEqual(1)
    }
  })
  it('is deterministic per seed', () => {
    const a = assignAreaCategories(createRng(9), widths(), bias)
    const b = assignAreaCategories(createRng(9), widths(), bias)
    expect(a).toEqual(b)
  })
  it('only emits Fase-1 categories', () => {
    const allowed = new Set(['battle', 'elite', 'boss', 'recruit', 'relic'])
    const cats = flat(assignAreaCategories(createRng(4), widths(), bias))
    expect(cats.every(c => allowed.has(c))).toBe(true)
  })
})
```

- [ ] **Step 2: Esegui i test per verificare che falliscano**

Run: `npx vitest run tests/engine/nodeGen.test.ts`
Expected: FAIL ("does not provide an export named 'assignAreaCategories'")

- [ ] **Step 3: Implementa `nodeGen.ts`**

Crea `game/engine/nodeGen.ts`:

```ts
import type { RunNodeType } from '@/types'
import type { Rng } from './rng'
import { BALANCE } from '@/data/constants'

export interface AreaBias {
  teamSize: number
  teamMax: number
}

type Filler = 'battle' | 'recruit' | 'relic'

/** Flat list of (floor, idx) coordinates for the middle floors only. */
interface Slot { floor: number; idx: number }

/**
 * Assign a category to every node of an area.
 * Hard guarantees: floor 0 = battle; last floor = boss; exactly one elite in a
 * mid floor within [eliteMinFloor, len-2]; at least one recruit and one relic
 * among the middle nodes. Remaining middle nodes are weighted fillers, with a
 * recruit bias when the team is incomplete.
 */
export function assignAreaCategories(rng: Rng, widths: number[], bias: AreaBias): RunNodeType[][] {
  const last = widths.length - 1
  const cats: RunNodeType[][] = widths.map(w => new Array<RunNodeType>(w).fill('battle'))

  cats[0] = ['battle']
  cats[last] = ['boss']

  // Collect middle slots.
  const slots: Slot[] = []
  for (let f = 1; f < last; f++) {
    for (let i = 0; i < widths[f]!; i++) slots.push({ floor: f, idx: i })
  }

  // 1. Place the single elite within the allowed floor band.
  const eliteFloors: number[] = []
  for (let f = BALANCE.map.eliteMinFloor; f <= last - 1; f++) {
    if (widths[f]! > 0) eliteFloors.push(f)
  }
  const eliteFloor = rng.pick(eliteFloors)
  const eliteIdx = rng.int(0, widths[eliteFloor]! - 1)
  setCat(cats, eliteFloor, eliteIdx, 'elite')
  const used = new Set<string>([key(eliteFloor, eliteIdx)])

  // 2. Guarantee >=1 recruit and >=1 relic among the remaining middle slots.
  const free = () => slots.filter(s => !used.has(key(s.floor, s.idx)))
  for (const must of ['recruit', 'relic'] as Filler[]) {
    const pool = free()
    if (pool.length === 0) break
    const s = rng.pick(pool)
    setCat(cats, s.floor, s.idx, must)
    used.add(key(s.floor, s.idx))
  }

  // 3. Fill the rest with weighted fillers (recruit-biased when team incomplete).
  for (const s of free()) {
    setCat(cats, s.floor, s.idx, pickFiller(rng, bias))
    used.add(key(s.floor, s.idx))
  }

  return cats
}

function pickFiller(rng: Rng, bias: AreaBias): Filler {
  const cw = BALANCE.map.categoryWeights
  const recruitW = cw.recruit + (bias.teamSize < bias.teamMax ? BALANCE.map.recruitBiasBoost : 0)
  const entries: [Filler, number][] = [['battle', cw.battle], ['recruit', recruitW], ['relic', cw.relic]]
  const total = entries.reduce((a, [, v]) => a + v, 0)
  let roll = rng.next() * total
  for (const [cat, v] of entries) {
    roll -= v
    if (roll <= 0) return cat
  }
  return 'battle'
}

const key = (f: number, i: number) => `${f}:${i}`
function setCat(cats: RunNodeType[][], floor: number, idx: number, cat: RunNodeType): void {
  cats[floor]![idx] = cat
}
```

- [ ] **Step 4: Esegui i test**

Run: `npx vitest run tests/engine/nodeGen.test.ts`
Expected: PASS (6 test)

- [ ] **Step 5: Commit**

```bash
git add game/engine/nodeGen.ts tests/engine/nodeGen.test.ts
git commit -m "feat(run): node category generator with hard guarantees + state bias"
```

---

## Task 5: Generazione mappa per-area (`map.ts`)

**Files:**
- Modify: `game/engine/map.ts` (aggiunte additive, non rimuovere `generateMap`/`nodeDepth` esistenti)
- Test: `tests/engine/area.test.ts`

**Interfaces:**
- Consumes: `Rng`; `assignAreaCategories`, `AreaBias` da `./nodeGen`; `BALANCE.map` (`floorsPerArea`, `minWidth`, `maxWidth`); `RunNode`.
- Produces:
  - `parseAreaNodeId(id: string): { area: number; floor: number; idx: number }` — per id `a{area}f{floor}n{idx}`
  - `generateArea(rng: Rng, area: number, bias: AreaBias): RunNode[]` — atlante di una singola area: piani × larghezza, archi a copertura piena, categorie da `assignAreaCategories`, id area-aware

- [ ] **Step 1: Scrivi i test (falliscono)**

Crea `tests/engine/area.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { generateArea, parseAreaNodeId } from '@/game/engine/map'
import { createRng } from '@/game/engine/rng'
import { BALANCE } from '@/data/constants'

const bias = { teamSize: 2, teamMax: 5 }

describe('generateArea', () => {
  it('parseAreaNodeId round-trips', () => {
    expect(parseAreaNodeId('a1f3n2')).toEqual({ area: 1, floor: 3, idx: 2 })
  })
  it('produces floorsPerArea floors with a single entry and single boss', () => {
    const nodes = generateArea(createRng(1), 0, bias)
    const floors = new Set(nodes.map(n => parseAreaNodeId(n.id).floor))
    expect(floors.size).toBe(BALANCE.map.floorsPerArea)
    expect(nodes.filter(n => parseAreaNodeId(n.id).floor === 0)).toHaveLength(1)
    expect(nodes.filter(n => n.type === 'boss')).toHaveLength(1)
  })
  it('tags every node with the correct area in its id', () => {
    const nodes = generateArea(createRng(5), 2, bias)
    expect(nodes.every(n => parseAreaNodeId(n.id).area === 2)).toBe(true)
  })
  it('is fully connected: every non-boss node has at least one outgoing edge', () => {
    const nodes = generateArea(createRng(3), 0, bias)
    const last = BALANCE.map.floorsPerArea - 1
    for (const n of nodes) {
      if (parseAreaNodeId(n.id).floor === last) continue
      expect(n.next.length).toBeGreaterThan(0)
    }
  })
  it('every edge points to an existing node on the next floor', () => {
    const nodes = generateArea(createRng(8), 1, bias)
    const byId = new Map(nodes.map(n => [n.id, n]))
    for (const n of nodes) {
      const f = parseAreaNodeId(n.id).floor
      for (const t of n.next) {
        expect(byId.has(t)).toBe(true)
        expect(parseAreaNodeId(t).floor).toBe(f + 1)
      }
    }
  })
  it('is deterministic per (seed, area, bias)', () => {
    const a = generateArea(createRng(7), 1, bias).map(n => `${n.id}:${n.type}:${n.next.join(',')}`)
    const b = generateArea(createRng(7), 1, bias).map(n => `${n.id}:${n.type}:${n.next.join(',')}`)
    expect(a).toEqual(b)
  })
})
```

- [ ] **Step 2: Esegui i test per verificare che falliscano**

Run: `npx vitest run tests/engine/area.test.ts`
Expected: FAIL ("does not provide an export named 'generateArea'")

- [ ] **Step 3: Implementa le aggiunte a `map.ts`**

In `game/engine/map.ts`, aggiungi in cima agli import:

```ts
import { assignAreaCategories, type AreaBias } from './nodeGen'
```

Poi aggiungi in fondo al file (senza toccare `generateMap`/`nodeDepth`/`nodeId` esistenti):

```ts
const areaNodeId = (area: number, floor: number, index: number) => `a${area}f${floor}n${index}`

/** Parse an area-aware node id of the form `a{area}f{floor}n{idx}`. */
export function parseAreaNodeId(id: string): { area: number; floor: number; idx: number } {
  const m = /^a(\d+)f(\d+)n(\d+)$/.exec(id)
  if (!m) throw new Error(`bad area node id: ${id}`)
  return { area: Number(m[1]), floor: Number(m[2]), idx: Number(m[3]) }
}

/**
 * Build one area's branching atlas. Floor 0 is a single entry battle; the last
 * floor is a single boss; middle floors have rng-width nodes. Categories come
 * from `assignAreaCategories`. Edges connect only adjacent floors with full
 * coverage (no orphans, no dead ends before the boss) — same wiring as
 * `generateMap`, but area-tagged.
 */
export function generateArea(rng: Rng, area: number, bias: AreaBias): RunNode[] {
  const { floorsPerArea, minWidth, maxWidth } = BALANCE.map
  const last = floorsPerArea - 1

  // 1. Floor widths.
  const widths: number[] = []
  for (let f = 0; f < floorsPerArea; f++) {
    widths.push(f === 0 || f === last ? 1 : rng.int(minWidth, maxWidth))
  }

  // 2. Categories (hard guarantees live in nodeGen).
  const cats = assignAreaCategories(rng.fork(777), widths, bias)

  // 3. Nodes.
  const floorNodes: RunNode[][] = widths.map((w, f) =>
    Array.from({ length: w }, (_, i) => ({ id: areaNodeId(area, f, i), type: cats[f]![i]!, next: [] as string[] })),
  )

  // 4. Edges f -> f+1 with full two-way coverage (mirrors generateMap).
  for (let f = 0; f < last; f++) {
    const cur = floorNodes[f]!
    const nxt = floorNodes[f + 1]!
    cur.forEach((node, i) => { node.next.push(nxt[i % nxt.length]!.id) })
    const covered = new Set(cur.flatMap(n => n.next))
    nxt.forEach((target, j) => {
      if (covered.has(target.id)) return
      const src = cur[j % cur.length]!
      if (!src.next.includes(target.id)) src.next.push(target.id)
    })
    if (nxt.length > 1) {
      cur.forEach((node, i) => {
        const extra = nxt[(i + 1) % nxt.length]!.id
        if (!node.next.includes(extra) && rng.chance(0.5)) node.next.push(extra)
      })
    }
    cur.forEach(node => node.next.sort())
  }

  return floorNodes.flat()
}
```

- [ ] **Step 4: Esegui i test**

Run: `npx vitest run tests/engine/area.test.ts`
Expected: PASS (6 test)

- [ ] **Step 5: Typecheck e suite completa (i moduli map esistenti restano intatti)**

Run: `npx tsc --noEmit`
Expected: exit 0

Run: `npx vitest run`
Expected: tutti i test passano (incluso il vecchio `tests/engine/map.test.ts` se presente — `generateMap` non è cambiato)

- [ ] **Step 6: Commit**

```bash
git add game/engine/map.ts tests/engine/area.test.ts
git commit -m "feat(run): per-area atlas generation with categorized nodes"
```

---

## Task 6: Catalogo nodi (`nodeCatalog.ts`)

**Files:**
- Create: `game/engine/nodeCatalog.ts`
- Test: `tests/engine/nodeCatalog.test.ts`

**Interfaces:**
- Consumes: `RunNodeType`.
- Produces:
  - `interface NodeKind { type: RunNodeType; label: string; emoji: string; theme: string; isCombat: boolean; resolverId: string; generatedInPhase: 1 | 2 | 3 }`
  - `NODE_CATALOG: Record<RunNodeType, NodeKind>`
  - `nodeKind(type: RunNodeType): NodeKind`
  - `phase1Types(): RunNodeType[]` — i tipi con `generatedInPhase === 1`

- [ ] **Step 1: Scrivi i test (falliscono)**

Crea `tests/engine/nodeCatalog.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { NODE_CATALOG, nodeKind, phase1Types } from '@/game/engine/nodeCatalog'

describe('node catalog', () => {
  it('has an entry for every Fase-1 type with coherent flags', () => {
    for (const t of ['battle', 'elite', 'boss', 'recruit', 'relic'] as const) {
      const k = nodeKind(t)
      expect(k.type).toBe(t)
      expect(k.label.length).toBeGreaterThan(0)
      expect(k.resolverId.length).toBeGreaterThan(0)
    }
  })
  it('marks combat nodes correctly', () => {
    expect(nodeKind('battle').isCombat).toBe(true)
    expect(nodeKind('elite').isCombat).toBe(true)
    expect(nodeKind('boss').isCombat).toBe(true)
    expect(nodeKind('recruit').isCombat).toBe(false)
    expect(nodeKind('relic').isCombat).toBe(false)
  })
  it('phase1Types returns exactly the generated Fase-1 categories', () => {
    expect(new Set(phase1Types())).toEqual(new Set(['battle', 'elite', 'boss', 'recruit', 'relic']))
  })
  it('every catalog entry is self-consistent (key matches type)', () => {
    for (const [key, kind] of Object.entries(NODE_CATALOG)) {
      expect(kind.type).toBe(key)
    }
  })
})
```

- [ ] **Step 2: Esegui i test per verificare che falliscano**

Run: `npx vitest run tests/engine/nodeCatalog.test.ts`
Expected: FAIL ("does not provide an export named 'NODE_CATALOG'")

- [ ] **Step 3: Implementa `nodeCatalog.ts`**

Crea `game/engine/nodeCatalog.ts`:

```ts
import type { RunNodeType } from '@/types'

export interface NodeKind {
  type: RunNodeType
  label: string
  emoji: string
  theme: string          // Hogwarts location flavor (used by Fase 4 rendering)
  isCombat: boolean
  resolverId: string
  generatedInPhase: 1 | 2 | 3
}

export const NODE_CATALOG: Record<RunNodeType, NodeKind> = {
  battle:     { type: 'battle',     label: 'Combattimento', emoji: '⚔️', theme: 'Corridoio',        isCombat: true,  resolverId: 'battle',     generatedInPhase: 1 },
  elite:      { type: 'elite',      label: 'Elite',         emoji: '⚫', theme: 'Duello',           isCombat: true,  resolverId: 'elite',      generatedInPhase: 1 },
  boss:       { type: 'boss',       label: 'Boss',          emoji: '👑', theme: 'Sala del Boss',    isCombat: true,  resolverId: 'boss',       generatedInPhase: 1 },
  recruit:    { type: 'recruit',    label: 'Reclutamento',  emoji: '👥', theme: 'Sala Comune',      isCombat: false, resolverId: 'recruit',    generatedInPhase: 1 },
  relic:      { type: 'relic',      label: 'Reliquia',      emoji: '💎', theme: 'Stanza Segreta',   isCombat: false, resolverId: 'relic',      generatedInPhase: 1 },
  shop:       { type: 'shop',       label: 'Negozio',       emoji: '🏪', theme: 'Diagon Alley',     isCombat: false, resolverId: 'shop',       generatedInPhase: 2 },
  event:      { type: 'event',      label: 'Evento',        emoji: '📖', theme: 'Imprevisto',       isCombat: false, resolverId: 'event',      generatedInPhase: 2 },
  commonRoom: { type: 'commonRoom', label: 'Sala Comune',   emoji: '🛏', theme: 'Sala Comune',      isCombat: false, resolverId: 'commonRoom', generatedInPhase: 2 },
  library:    { type: 'library',    label: 'Biblioteca',    emoji: '📚', theme: 'Biblioteca',       isCombat: false, resolverId: 'library',    generatedInPhase: 3 },
  potions:    { type: 'potions',    label: 'Aula Pozioni',  emoji: '🧪', theme: 'Sotterranei',      isCombat: false, resolverId: 'potions',    generatedInPhase: 3 },
  forest:     { type: 'forest',     label: 'Foresta',       emoji: '🌲', theme: 'Foresta Proibita', isCombat: false, resolverId: 'forest',     generatedInPhase: 3 },
}

export function nodeKind(type: RunNodeType): NodeKind {
  return NODE_CATALOG[type]
}

export function phase1Types(): RunNodeType[] {
  return (Object.values(NODE_CATALOG) as NodeKind[])
    .filter(k => k.generatedInPhase === 1)
    .map(k => k.type)
}
```

- [ ] **Step 4: Esegui i test**

Run: `npx vitest run tests/engine/nodeCatalog.test.ts`
Expected: PASS (4 test)

- [ ] **Step 5: Typecheck e suite completa finale**

Run: `npx tsc --noEmit`
Expected: exit 0

Run: `npx vitest run`
Expected: tutti i test passano

- [ ] **Step 6: Commit**

```bash
git add game/engine/nodeCatalog.ts tests/engine/nodeCatalog.test.ts
git commit -m "feat(run): node catalog — extensible type metadata + resolver ids"
```

---

## Definition of Done (Piano A)

- [ ] `npx tsc --noEmit` → exit 0
- [ ] `npx vitest run` → tutti i test verdi (vecchi + nuovi)
- [ ] Nessun file in `game/engine/combat/*` modificato
- [ ] `RunState`, `run.ts`, `useRun.ts` invariati (l'integrazione è il Piano B)
- [ ] Moduli consegnati: `leveling`, `recruit`, `nodeGen`, `map.generateArea`, `nodeCatalog` + tipi/costanti

## Cosa NON è in questo piano (→ Piano B)

Riscrittura `RunState` (house/area/log/pendingLevelUps) · resolver registry · refactor `run.ts` (`confirmStart`, `resolveNode`, transizione d'area) · `statBreakdown.ts` · `runStore.ts` (persistenza) · FSM `useRun` · schermate (HouseSelect, StarterPick, Recruit, Relic, LevelUp, MapScreen esteso) · riscrittura e calibrazione di `campaignBalance.test.ts` (i due assi di crescita).
