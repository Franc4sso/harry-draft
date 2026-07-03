# Meta-Layer & Retention Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the roguelite a persistent meta-layer — a saved profile, content unlocks (hybrid: milestones + a "Cioccorane" currency), an end-of-run reward ceremony, a collection/hub screen, and a light seeded boss pool — so players have a reason to return after each run.

**Architecture:** A pure, React-free persistence module (`lib/metaStore.ts`) owns a `harry:profile:v1` localStorage record, sibling to the untouched `harry:run:v1`. A data module (`data/unlocks.ts`) is the single source of truth for the starter sets, milestone table, currency costs and earning formula. A pure rules module (`lib/metaProgress.ts`) turns a finished run into currency + milestone unlocks. The engine gains two tiny module-global "pool restriction" seams (`draft.ts`, `relics.ts`) that hide locked content from the player while leaving enemy generation untouched. The React layer (`useRunB.ts`, `ResultScreen.tsx`, a new `CollectionScreen.tsx`) is a thin consumer. A `BOSSES_BY_AREA` pool + a seeded pick in `battlePackage.ts` adds boss variety.

**Tech Stack:** TypeScript, Next.js (custom in-repo build — see `AGENTS.md`), React 18 + framer-motion, Vitest, Tailwind. Path alias `@/` → repo root.

## Global Constraints

- **Horizontal only.** Unlocks and currency add variety, never power. No unlock may be statistically stronger than the starter pool. Currency never buys power.
- **Balance is a hard gate.** The restricted starter pool MUST keep the near-optimal-bot win rate above the live floor `0.07` in `tests/engine/campaignBalanceB.test.ts`. This is verified by a new cloned harness, not by inspection.
- **Enemies are never restricted.** Pool restrictions apply to the *player* draft/recruit/relic offers only. Enemy team generation (`teamGen.ts`, which reads `WIZARDS` directly) must stay untouched.
- **Engine stays pure & deterministic.** No `localStorage`, `Date.now()`, or `Math.random()` inside `game/engine/**`. All profile/persistence reads happen in the React layer (`hooks/`, `components/`) or `lib/`.
- **Idempotent unlocks.** Re-firing a milestone or re-buying an owned item is a no-op.
- **Never reintroduce the "menace" multiplier** (removed by prior decision) as a balance lever.
- **Italian UI copy** — all player-facing strings in Italian, matching existing screens.
- **New TS files** follow existing style: `import type` for types, named exports, no default exports, 2-space indent.

---

## File Structure

**Create:**
- `lib/metaStore.ts` — profile persistence + pure profile mutators (Task 1)
- `tests/lib/metaStore.test.ts` — (Task 1)
- `data/unlocks.ts` — starter sets, milestone table, costs, earning params (Task 2)
- `lib/metaProgress.ts` — `buildRunEndSummary`, `earnCioccorane`, `evaluateMilestones`, `recordRunEnd` (Task 2)
- `tests/lib/metaProgress.test.ts` — (Task 2)
- `tests/data/unlocks.test.ts` — starter-set invariants + reachability (Task 2)
- `tests/engine/campaignBalanceRestricted.test.ts` — the Reservation-1 balance gate (Task 3)
- `tests/engine/draftRestriction.test.ts` — (Task 3)
- `components/screens/CollectionScreen.tsx` — the hub/collection (Task 9)

**Modify:**
- `game/engine/draft.ts` — add `setDraftPoolRestriction`, filter `createDraftPool` (Task 3)
- `game/engine/relics.ts` — add `setRelicPoolRestriction`, filter the offer pool (Task 4)
- `data/bosses.ts` — add `BOSSES_BY_AREA` + alt bosses (Task 6)
- `game/engine/combat/battlePackage.ts` — seeded boss pick from the pool (Task 6)
- `tests/engine/combat/*` — boss-pool determinism test (Task 6)
- `hooks/useRunB.ts` — apply restrictions at run start, `markSeen` hooks, fire `recordRunEnd` on run end (Tasks 5, 7)
- `components/screens/ResultScreen.tsx` — the reward ceremony (Task 8)
- the menu screen (`components/screens/MenuScreen.tsx` or equivalent) — add a "Collezione" entry (Task 9)

---

## Task 1: Profile persistence store (`lib/metaStore.ts`)

The foundation: a typed profile, load/save with default + forward migration, and pure mutators. React-free, dependency-free (no imports from `data/` or `game/`).

**Files:**
- Create: `lib/metaStore.ts`
- Test: `tests/lib/metaStore.test.ts`

**Interfaces:**
- Produces:
  - `interface MetaProfile { version: 1; cioccorane: number; unlockedWizards: string[]; unlockedRelics: string[]; unlockedBosses: string[]; milestones: Record<string, boolean>; stats: MetaStats; codex: MetaCodex }`
  - `interface MetaStats { runsPlayed: number; runsWon: number; bossesKilled: number; bestStageReached: number; totalCioccoraneEarned: number; wizardUsage: Record<string, number> }`
  - `interface MetaCodex { wizardsSeen: string[]; relicsSeen: string[]; synergiesSeen: string[]; bossesSeen: string[] }`
  - `PROFILE_KEY = 'harry:profile:v1'`
  - `defaultProfile(): MetaProfile`
  - `loadProfile(): MetaProfile`
  - `saveProfile(p: MetaProfile): void`
  - `grantCioccorane(p, n): MetaProfile`
  - `spendCioccorane(p, n): MetaProfile | null` (null if insufficient)
  - `unlockWizard(p, id): MetaProfile` / `unlockRelic(p, id): MetaProfile` / `unlockBoss(p, id): MetaProfile` (idempotent)
  - `markSeen(p, kind: 'wizard' | 'relic' | 'synergy' | 'boss', id: string): MetaProfile`

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/metaStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import {
  PROFILE_KEY, defaultProfile, loadProfile, saveProfile,
  grantCioccorane, spendCioccorane, unlockWizard, markSeen,
} from '@/lib/metaStore'

beforeEach(() => localStorage.clear())

describe('metaStore', () => {
  it('returns a fresh default profile when storage is empty', () => {
    const p = loadProfile()
    expect(p.version).toBe(1)
    expect(p.cioccorane).toBe(0)
    expect(p.unlockedWizards).toEqual([])
    expect(p.codex.wizardsSeen).toEqual([])
  })

  it('round-trips a saved profile', () => {
    const p = grantCioccorane(defaultProfile(), 50)
    saveProfile(p)
    expect(loadProfile().cioccorane).toBe(50)
  })

  it('returns a default (never throws) on corrupt JSON', () => {
    localStorage.setItem(PROFILE_KEY, '{not json')
    expect(loadProfile().cioccorane).toBe(0)
  })

  it('spendCioccorane returns null when insufficient and never goes negative', () => {
    const p = grantCioccorane(defaultProfile(), 30)
    expect(spendCioccorane(p, 40)).toBeNull()
    expect(spendCioccorane(p, 30)!.cioccorane).toBe(0)
  })

  it('unlockWizard is idempotent', () => {
    const once = unlockWizard(defaultProfile(), 'luna')
    const twice = unlockWizard(once, 'luna')
    expect(twice.unlockedWizards).toEqual(['luna'])
  })

  it('markSeen dedupes and is pure', () => {
    const base = defaultProfile()
    const seen = markSeen(markSeen(base, 'wizard', 'draco'), 'wizard', 'draco')
    expect(seen.codex.wizardsSeen).toEqual(['draco'])
    expect(base.codex.wizardsSeen).toEqual([]) // input not mutated
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/metaStore.test.ts`
Expected: FAIL — cannot resolve `@/lib/metaStore`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/metaStore.ts
export interface MetaStats {
  runsPlayed: number
  runsWon: number
  bossesKilled: number
  bestStageReached: number
  totalCioccoraneEarned: number
  wizardUsage: Record<string, number>
}
export interface MetaCodex {
  wizardsSeen: string[]
  relicsSeen: string[]
  synergiesSeen: string[]
  bossesSeen: string[]
}
export interface MetaProfile {
  version: 1
  cioccorane: number
  unlockedWizards: string[]
  unlockedRelics: string[]
  unlockedBosses: string[]
  milestones: Record<string, boolean>
  stats: MetaStats
  codex: MetaCodex
}

export const PROFILE_KEY = 'harry:profile:v1'

export function defaultProfile(): MetaProfile {
  return {
    version: 1,
    cioccorane: 0,
    unlockedWizards: [],
    unlockedRelics: [],
    unlockedBosses: [],
    milestones: {},
    stats: {
      runsPlayed: 0, runsWon: 0, bossesKilled: 0,
      bestStageReached: 0, totalCioccoraneEarned: 0, wizardUsage: {},
    },
    codex: { wizardsSeen: [], relicsSeen: [], synergiesSeen: [], bossesSeen: [] },
  }
}

function ls(): Storage | null {
  return typeof localStorage !== 'undefined' ? localStorage : null
}

export function loadProfile(): MetaProfile {
  const store = ls()
  if (!store) return defaultProfile()
  const raw = store.getItem(PROFILE_KEY)
  if (!raw) return defaultProfile()
  try {
    const parsed = JSON.parse(raw) as Partial<MetaProfile>
    if (!parsed || parsed.version !== 1) return defaultProfile()
    // Merge onto a default so a partial/older record never yields undefined fields.
    const d = defaultProfile()
    return {
      ...d, ...parsed,
      stats: { ...d.stats, ...(parsed.stats ?? {}) },
      codex: { ...d.codex, ...(parsed.codex ?? {}) },
    }
  } catch {
    return defaultProfile()
  }
}

export function saveProfile(p: MetaProfile): void {
  ls()?.setItem(PROFILE_KEY, JSON.stringify(p))
}

export function grantCioccorane(p: MetaProfile, n: number): MetaProfile {
  return {
    ...p,
    cioccorane: p.cioccorane + n,
    stats: { ...p.stats, totalCioccoraneEarned: p.stats.totalCioccoraneEarned + Math.max(0, n) },
  }
}

export function spendCioccorane(p: MetaProfile, n: number): MetaProfile | null {
  if (n > p.cioccorane) return null
  return { ...p, cioccorane: p.cioccorane - n }
}

function addUnique(list: string[], id: string): string[] {
  return list.includes(id) ? list : [...list, id]
}

export function unlockWizard(p: MetaProfile, id: string): MetaProfile {
  return { ...p, unlockedWizards: addUnique(p.unlockedWizards, id) }
}
export function unlockRelic(p: MetaProfile, id: string): MetaProfile {
  return { ...p, unlockedRelics: addUnique(p.unlockedRelics, id) }
}
export function unlockBoss(p: MetaProfile, id: string): MetaProfile {
  return { ...p, unlockedBosses: addUnique(p.unlockedBosses, id) }
}

export function markSeen(
  p: MetaProfile, kind: 'wizard' | 'relic' | 'synergy' | 'boss', id: string,
): MetaProfile {
  const key = ({ wizard: 'wizardsSeen', relic: 'relicsSeen', synergy: 'synergiesSeen', boss: 'bossesSeen' } as const)[kind]
  return { ...p, codex: { ...p.codex, [key]: addUnique(p.codex[key], id) } }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/metaStore.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/metaStore.ts tests/lib/metaStore.test.ts
git commit -m "feat(meta): persistent profile store (harry:profile:v1)"
```

---

## Task 2: Unlock data + run-end rules (`data/unlocks.ts`, `lib/metaProgress.ts`)

The single source of truth for what is locked/costs/earns, plus the pure logic that turns a finished run into currency + milestone unlocks.

**Files:**
- Create: `data/unlocks.ts`, `lib/metaProgress.ts`
- Test: `tests/data/unlocks.test.ts`, `tests/lib/metaProgress.test.ts`

**Interfaces:**
- Consumes: `MetaProfile`, `grantCioccorane`, `unlockWizard`, `unlockRelic` (Task 1); `WIZARDS` (`@/data/wizards`); `RunState`, `BALANCE` (`@/data/constants`).
- Produces (`data/unlocks.ts`):
  - `STARTER_WIZARDS: string[]` — authored per the rules below; correctness enforced by `tests/data/unlocks.test.ts`.
  - `STARTER_RELICS: string[]`
  - `UNLOCK_COSTS = { wizard: 100, relic: 60 } as const`
  - `interface UnlockTarget { kind: 'wizard' | 'relic'; id: string; label: string }`
  - `interface Milestone { id: string; when: (s: RunEndSummary) => boolean; unlock: UnlockTarget }`
  - `MILESTONES: Milestone[]`
  - `EARN = { perAreaCleared: 15, perBossDefeated: 20, firstWinBonus: 60, lossFloor: 10 } as const`
- Produces (`lib/metaProgress.ts`):
  - `interface RunEndSummary { outcome: 'win' | 'defeat'; areasCleared: number; bossesDefeated: number; namedSynergiesActive: string[]; teamWizardIds: string[] }`
  - `buildRunEndSummary(run: RunState): RunEndSummary`
  - `earnCioccorane(s: RunEndSummary): number`
  - `evaluateMilestones(p: MetaProfile, s: RunEndSummary): { profile: MetaProfile; unlocked: UnlockTarget[] }`
  - `recordRunEnd(p: MetaProfile, s: RunEndSummary): { profile: MetaProfile; earned: number; unlocked: UnlockTarget[] }`

**Authoring rules for `STARTER_WIZARDS`** (enforced mechanically by the test in this task, then winnability-verified by Task 3):
- 18–22 ids, every id present in `WIZARDS`.
- Include **all tier-1 and all tier-2** wizards (the game's strong core — keeps the pool power-representative so restricting it doesn't lower reachable power, satisfying "horizontal").
- Fill the rest with a tier-3/4 sample that **covers all 4 houses and all 4 roles**.
- Must contain **≥3 Grifondoro** (the bot's starter offer is Grifondoro-only), **harry/ron/hermione** (keeps Golden Trio reachable from run 1), and **≥3 wizards tagged `veleno`** (keeps the "veleno counters Muro" affordance early).

- [ ] **Step 1: Write the failing invariant test**

```ts
// tests/data/unlocks.test.ts
import { describe, it, expect } from 'vitest'
import { STARTER_WIZARDS, MILESTONES, UNLOCK_COSTS } from '@/data/unlocks'
import { WIZARDS } from '@/data/wizards'

const byId = new Map(WIZARDS.map(w => [w.id, w]))

describe('starter wizard set invariants', () => {
  it('is 18-22 ids and every id exists', () => {
    expect(STARTER_WIZARDS.length).toBeGreaterThanOrEqual(18)
    expect(STARTER_WIZARDS.length).toBeLessThanOrEqual(22)
    for (const id of STARTER_WIZARDS) expect(byId.has(id)).toBe(true)
  })
  it('covers all houses and roles', () => {
    const houses = new Set(STARTER_WIZARDS.map(id => byId.get(id)!.house))
    const roles = new Set(STARTER_WIZARDS.map(id => byId.get(id)!.role))
    expect(houses).toEqual(new Set(['Grifondoro', 'Serpeverde', 'Corvonero', 'Tassorosso']))
    expect(roles.size).toBe(4)
  })
  it('has >=3 Grifondoro, the trio, and >=3 veleno', () => {
    const grif = STARTER_WIZARDS.filter(id => byId.get(id)!.house === 'Grifondoro')
    expect(grif.length).toBeGreaterThanOrEqual(3)
    for (const id of ['harry', 'ron', 'hermione']) expect(STARTER_WIZARDS).toContain(id)
    const veleno = STARTER_WIZARDS.filter(id => (byId.get(id)!.tags ?? []).includes('veleno'))
    expect(veleno.length).toBeGreaterThanOrEqual(3)
  })
})

describe('reachability: nothing is permanently unreachable', () => {
  it('every non-starter wizard is unlockable via a milestone or purchasable', () => {
    const milestoneWizards = new Set(
      MILESTONES.filter(m => m.unlock.kind === 'wizard').map(m => m.unlock.id),
    )
    for (const w of WIZARDS) {
      const reachable = STARTER_WIZARDS.includes(w.id) || milestoneWizards.has(w.id) || UNLOCK_COSTS.wizard > 0
      expect(reachable).toBe(true) // purchasable fallback (cost>0) guarantees reachability
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/data/unlocks.test.ts`
Expected: FAIL — cannot resolve `@/data/unlocks`.

- [ ] **Step 3: Author `data/unlocks.ts`**

Enumerate `data/wizards.ts` (all 60) and author `STARTER_WIZARDS` to satisfy the rules above. Author `MILESTONES` using conditions expressible from `RunEndSummary`. Skeleton (fill `STARTER_WIZARDS`/`STARTER_RELICS` with real ids from the roster, and map milestone unlocks to real locked ids):

```ts
// data/unlocks.ts
import type { RunEndSummary } from '@/lib/metaProgress'

// Authored per the rules in the plan; enforced by tests/data/unlocks.test.ts.
// All tier-1 + all tier-2 wizards, plus a house/role-covering tier-3/4 sample.
export const STARTER_WIZARDS: string[] = [
  'harry', 'ron', 'hermione', 'dumbledore', 'voldemort', 'snape', 'bellatrix',
  // ...author the remaining ids to reach 18-22 and satisfy every invariant test...
]

export const STARTER_RELICS: string[] = [
  // ...~12 relic ids from data/relics.ts, covering the lower rarities...
]

export const UNLOCK_COSTS = { wizard: 100, relic: 60 } as const

export const EARN = { perAreaCleared: 15, perBossDefeated: 20, firstWinBonus: 60, lossFloor: 10 } as const

export interface UnlockTarget { kind: 'wizard' | 'relic'; id: string; label: string }
export interface Milestone { id: string; when: (s: RunEndSummary) => boolean; unlock: UnlockTarget }

export const MILESTONES: Milestone[] = [
  { id: 'beat-muro', when: s => s.bossesDefeated >= 1, unlock: { kind: 'wizard', id: 'lucius', label: 'Lucius Malfoy' } },
  { id: 'beat-bellatrix', when: s => s.bossesDefeated >= 2, unlock: { kind: 'wizard', id: 'dolohov', label: 'Antonin Dolohov' } },
  { id: 'first-win', when: s => s.outcome === 'win', unlock: { kind: 'wizard', id: 'grindelwald', label: 'Gellert Grindelwald' } },
  { id: 'reach-area-2', when: s => s.areasCleared >= 3, unlock: { kind: 'relic', id: 'timeturner', label: 'Giratempo' } },
  // Named-synergy milestone: fires if the player finished with that synergy active.
  { id: 'trio-complete', when: s => s.namedSynergiesActive.includes('goldenTrio'), unlock: { kind: 'wizard', id: 'neville', label: 'Neville Paciock' } },
]
```
(The exact locked ids above are examples — use real ids from `data/wizards.ts`/`data/relics.ts` that are NOT in the starter sets. The reachability test guarantees purchasable fallback, so milestones need not cover every id.)

- [ ] **Step 4: Write the failing metaProgress test**

```ts
// tests/lib/metaProgress.test.ts
import { describe, it, expect } from 'vitest'
import { earnCioccorane, evaluateMilestones, recordRunEnd, type RunEndSummary } from '@/lib/metaProgress'
import { defaultProfile } from '@/lib/metaStore'

const winSummary: RunEndSummary = {
  outcome: 'win', areasCleared: 3, bossesDefeated: 3,
  namedSynergiesActive: ['goldenTrio'], teamWizardIds: ['harry', 'ron', 'hermione'],
}
const lossSummary: RunEndSummary = {
  outcome: 'defeat', areasCleared: 1, bossesDefeated: 0,
  namedSynergiesActive: [], teamWizardIds: ['harry'],
}

describe('earnCioccorane', () => {
  it('a full win pays area + boss + first-win bonus', () => {
    // 3*15 + 3*20 + 60 = 165
    expect(earnCioccorane(winSummary)).toBe(165)
  })
  it('a loss still pays at least the loss floor', () => {
    expect(earnCioccorane(lossSummary)).toBeGreaterThanOrEqual(10)
  })
})

describe('evaluateMilestones', () => {
  it('fires matching milestones once and unlocks their targets', () => {
    const first = evaluateMilestones(defaultProfile(), winSummary)
    expect(first.unlocked.map(u => u.id).sort()).toEqual(['dolohov', 'grindelwald', 'lucius', 'neville'].sort())
    // Re-running with the already-updated profile fires nothing new.
    const second = evaluateMilestones(first.profile, winSummary)
    expect(second.unlocked).toEqual([])
  })
})

describe('recordRunEnd', () => {
  it('grants currency, applies unlocks, and updates stats', () => {
    const { profile, earned, unlocked } = recordRunEnd(defaultProfile(), winSummary)
    expect(earned).toBe(165)
    expect(profile.cioccorane).toBe(165)
    expect(profile.stats.runsPlayed).toBe(1)
    expect(profile.stats.runsWon).toBe(1)
    expect(profile.stats.bossesKilled).toBe(3)
    expect(profile.unlockedWizards).toEqual(expect.arrayContaining(['lucius', 'dolohov', 'grindelwald', 'neville']))
    expect(unlocked.length).toBe(4)
  })
})
```

- [ ] **Step 5: Run tests to verify they fail**

Run: `npx vitest run tests/lib/metaProgress.test.ts`
Expected: FAIL — cannot resolve `@/lib/metaProgress`.

- [ ] **Step 6: Write `lib/metaProgress.ts`**

```ts
// lib/metaProgress.ts
import type { RunState } from '@/types'
import { BALANCE } from '@/data/constants'
import type { MetaProfile } from '@/lib/metaStore'
import { grantCioccorane, unlockWizard, unlockRelic } from '@/lib/metaStore'
import { MILESTONES, EARN, type UnlockTarget } from '@/data/unlocks'

const NAMED_SYNERGY_IDS = new Set([
  'goldenTrio', 'weasleyFamily', 'orderOfPhoenix', 'deathEaters', 'tossicita',
  'spietatezza', 'bastione', 'oscurita', 'malandrini', 'esercitoSilente',
])

export interface RunEndSummary {
  outcome: 'win' | 'defeat'
  areasCleared: number
  bossesDefeated: number
  namedSynergiesActive: string[]
  teamWizardIds: string[]
}

/** Derive the meta-relevant summary from a finished RunState (phase 'win' | 'defeat').
 *  bossesDefeated: advancing past area N means area N's boss fell, so a defeat at
 *  area A implies A bosses down; a win means all areas' bosses fell. */
export function buildRunEndSummary(run: RunState): RunEndSummary {
  const outcome: 'win' | 'defeat' = run.phase === 'win' ? 'win' : 'defeat'
  const area = run.area ?? 0
  const bossesDefeated = outcome === 'win' ? BALANCE.map.areas : area
  return {
    outcome,
    areasCleared: outcome === 'win' ? BALANCE.map.areas : area,
    bossesDefeated,
    namedSynergiesActive: (run.activeSynergies ?? [])
      .map(a => a.synergy.id)
      .filter(id => NAMED_SYNERGY_IDS.has(id)),
    teamWizardIds: run.team.map(d => d.wizard.id),
  }
}

export function earnCioccorane(s: RunEndSummary): number {
  const base = s.areasCleared * EARN.perAreaCleared + s.bossesDefeated * EARN.perBossDefeated
  const withWin = s.outcome === 'win' ? base + EARN.firstWinBonus : base
  return Math.max(EARN.lossFloor, withWin)
}

export function evaluateMilestones(
  p: MetaProfile, s: RunEndSummary,
): { profile: MetaProfile; unlocked: UnlockTarget[] } {
  let profile = p
  const unlocked: UnlockTarget[] = []
  for (const m of MILESTONES) {
    if (profile.milestones[m.id]) continue
    if (!m.when(s)) continue
    profile = { ...profile, milestones: { ...profile.milestones, [m.id]: true } }
    profile = m.unlock.kind === 'wizard'
      ? unlockWizard(profile, m.unlock.id)
      : unlockRelic(profile, m.unlock.id)
    unlocked.push(m.unlock)
  }
  return { profile, unlocked }
}

export function recordRunEnd(
  p: MetaProfile, s: RunEndSummary,
): { profile: MetaProfile; earned: number; unlocked: UnlockTarget[] } {
  const earned = earnCioccorane(s)
  let profile = grantCioccorane(p, earned)
  const usage = { ...profile.stats.wizardUsage }
  for (const id of s.teamWizardIds) usage[id] = (usage[id] ?? 0) + 1
  profile = {
    ...profile,
    stats: {
      ...profile.stats,
      runsPlayed: profile.stats.runsPlayed + 1,
      runsWon: profile.stats.runsWon + (s.outcome === 'win' ? 1 : 0),
      bossesKilled: profile.stats.bossesKilled + s.bossesDefeated,
      bestStageReached: Math.max(profile.stats.bestStageReached, s.areasCleared),
      wizardUsage: usage,
    },
  }
  const evalResult = evaluateMilestones(profile, s)
  return { profile: evalResult.profile, earned, unlocked: evalResult.unlocked }
}
```

**Note:** verify the named-synergy ids in `NAMED_SYNERGY_IDS` and the `'goldenTrio'` id used in `MILESTONES` against `data/synergies.ts` before finishing — adjust to the real ids if they differ.

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run tests/lib/metaProgress.test.ts tests/data/unlocks.test.ts`
Expected: PASS (both files).

- [ ] **Step 8: Commit**

```bash
git add data/unlocks.ts lib/metaProgress.ts tests/data/unlocks.test.ts tests/lib/metaProgress.test.ts
git commit -m "feat(meta): unlock data + run-end currency/milestone rules"
```

---

## Task 3: Draft pool restriction + the balance gate (Reservation 1)

The single seam that hides locked wizards from the player, and the cloned harness that PROVES the starter set is winnable. This is the balance gate — do not proceed to UI wiring until it passes.

**Files:**
- Modify: `game/engine/draft.ts:6-8`
- Test: `tests/engine/draftRestriction.test.ts`, `tests/engine/campaignBalanceRestricted.test.ts`

**Interfaces:**
- Consumes: `STARTER_WIZARDS` (Task 2); the balance harness in `tests/engine/campaignBalanceB.test.ts`.
- Produces: `setDraftPoolRestriction(ids: Iterable<string> | null): void`; `createDraftPool()` now returns the restricted subset when a restriction is set.

- [ ] **Step 1: Write the failing restriction test**

```ts
// tests/engine/draftRestriction.test.ts
import { describe, it, expect, afterEach } from 'vitest'
import { createDraftPool, setDraftPoolRestriction } from '@/game/engine/draft'
import { WIZARDS } from '@/data/wizards'

afterEach(() => setDraftPoolRestriction(null))

describe('draft pool restriction', () => {
  it('returns all wizards when no restriction is set', () => {
    expect(createDraftPool().length).toBe(WIZARDS.length)
  })
  it('returns only the restricted subset', () => {
    setDraftPoolRestriction(['harry', 'ron'])
    const ids = createDraftPool().map(w => w.id).sort()
    expect(ids).toEqual(['harry', 'ron'])
  })
  it('clearing the restriction restores the full pool', () => {
    setDraftPoolRestriction(['harry'])
    setDraftPoolRestriction(null)
    expect(createDraftPool().length).toBe(WIZARDS.length)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/draftRestriction.test.ts`
Expected: FAIL — `setDraftPoolRestriction` is not exported.

- [ ] **Step 3: Add the seam to `draft.ts`**

Replace lines 6-8 (`createDraftPool`) with:

```ts
let poolRestriction: ReadonlySet<string> | null = null

/** Restrict the PLAYER's draft/recruit pool to a subset of wizard ids (or null to
 *  clear). Enemy generation reads WIZARDS directly and is unaffected. */
export function setDraftPoolRestriction(ids: Iterable<string> | null): void {
  poolRestriction = ids ? new Set(ids) : null
}

export function createDraftPool(): Wizard[] {
  return poolRestriction ? WIZARDS.filter(w => poolRestriction!.has(w.id)) : [...WIZARDS]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/engine/draftRestriction.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Write the balance gate (clone of the live harness)**

Copy the `runOne` / `pickNode` / `isVeleno` helpers and imports verbatim from `tests/engine/campaignBalanceB.test.ts` (lines 1-10, 307-375) into the new file, then wrap the sweep:

```ts
// tests/engine/campaignBalanceRestricted.test.ts
import { describe, it, expect } from 'vitest'
import {
  startRunB, starterOffer, chooseStarters, reachable, moveTo, resolveCurrent,
  clearAreaAndAdvance, registerCoreResolvers,
} from '@/game/engine/runEngine'
import { recruitOffer, relicOffer } from '@/game/engine/resolvers/recruit'
import { createRng } from '@/game/engine/rng'
import { powerOf } from '@/game/engine/combat/teamGen'
import { setDraftPoolRestriction } from '@/game/engine/draft'
import { STARTER_WIZARDS } from '@/data/unlocks'
import type { RunNode, RunState } from '@/types'

registerCoreResolvers()

// --- paste pickNode / isVeleno / runOne here, verbatim from campaignBalanceB.test.ts ---

describe('restricted starter pool is winnable (Reservation 1 gate)', () => {
  const N = 120
  setDraftPoolRestriction(STARTER_WIZARDS)
  const outcomes = Array.from({ length: N }, (_, i) => runOne(`run-${i}`))
  setDraftPoolRestriction(null) // reset so other suites see the full 60
  const winRate = outcomes.filter(o => o === 'win').length / N

  // eslint-disable-next-line no-console
  console.log(`[campaignBalanceRestricted] winRate=${winRate.toFixed(4)}`)

  it('clears the same 0.07 floor as the full-pool harness', () => {
    expect(winRate).toBeGreaterThan(0.07)
    expect(winRate).toBeLessThan(0.45)
  })
})
```

- [ ] **Step 6: Run the gate and iterate the starter set until it passes**

Run: `npx vitest run tests/engine/campaignBalanceRestricted.test.ts`
Expected: PASS. If `winRate <= 0.07`, the restricted pool is too weak — adjust `STARTER_WIZARDS` (add stronger/more-synergistic wizards while keeping every invariant in `tests/data/unlocks.test.ts` green) and re-run. If it cannot be made to pass within the invariants, STOP and report: the fallback is a gentler lock (larger starter set) — a user decision.

- [ ] **Step 7: Confirm the full-pool harness is unaffected**

Run: `npx vitest run tests/engine/campaignBalanceB.test.ts`
Expected: PASS (the restriction is cleared before other suites run).

- [ ] **Step 8: Commit**

```bash
git add game/engine/draft.ts tests/engine/draftRestriction.test.ts tests/engine/campaignBalanceRestricted.test.ts
git commit -m "feat(meta): draft pool restriction + restricted-pool balance gate"
```

---

## Task 4: Relic pool restriction (`game/engine/relics.ts`)

Mirror the draft seam for relic offers so locked relics don't appear for the player. Same module-global pattern.

**Files:**
- Modify: `game/engine/relics.ts` (the `offerRelics` function and the array it draws from)
- Test: `tests/engine/relicRestriction.test.ts`

**Interfaces:**
- Produces: `setRelicPoolRestriction(ids: Iterable<string> | null): void`; `offerRelics` now draws only from unrestricted relics when a restriction is set.

- [ ] **Step 1: Read `game/engine/relics.ts`** to find the base relic array `offerRelics` uses (it imports/uses `RELICS` from `@/data/relics`) and the offer size.

- [ ] **Step 2: Write the failing test**

```ts
// tests/engine/relicRestriction.test.ts
import { describe, it, expect, afterEach } from 'vitest'
import { offerRelics, setRelicPoolRestriction } from '@/game/engine/relics'
import { createRng } from '@/game/engine/rng'

afterEach(() => setRelicPoolRestriction(null))

describe('relic pool restriction', () => {
  it('never offers a relic outside the restriction set', () => {
    setRelicPoolRestriction(['pietra_filosofale'])
    const offer = offerRelics(createRng('seed-1').fork(1), [], 0)
    for (const r of offer) expect(r.id).toBe('pietra_filosofale')
  })
})
```
(Use a real relic id from `data/relics.ts` in place of `pietra_filosofale`.)

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/engine/relicRestriction.test.ts`
Expected: FAIL — `setRelicPoolRestriction` not exported.

- [ ] **Step 4: Add the seam to `relics.ts`**

Add near the top of the module:

```ts
let relicRestriction: ReadonlySet<string> | null = null
export function setRelicPoolRestriction(ids: Iterable<string> | null): void {
  relicRestriction = ids ? new Set(ids) : null
}
function restrictedRelicPool(all: Relic[]): Relic[] {
  return relicRestriction ? all.filter(r => relicRestriction!.has(r.id)) : all
}
```

Then, inside `offerRelics`, wrap the base pool (the `RELICS` array it currently reads) with `restrictedRelicPool(...)` before the rarity-weighting/offer selection runs. Do not change the exclusion-of-owned or rarity logic.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/engine/relicRestriction.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add game/engine/relics.ts tests/engine/relicRestriction.test.ts
git commit -m "feat(meta): relic pool restriction seam"
```

---

## Task 5: Wire restrictions + codex at run start (`hooks/useRunB.ts`)

Apply the pool restrictions from the profile before any offer is computed, and mark encountered content as "seen".

**Files:**
- Modify: `hooks/useRunB.ts`

**Interfaces:**
- Consumes: `loadProfile`, `saveProfile`, `markSeen` (Task 1); `STARTER_WIZARDS`, `STARTER_RELICS` (Task 2); `setDraftPoolRestriction` (Task 3); `setRelicPoolRestriction` (Task 4).

- [ ] **Step 1: Apply the restriction once, synchronously, before children render**

Near the top of `useRunB`, after `const [run, setRunState] = ...`, add a memo that runs during render (before `DraftScreen`/offers are evaluated):

```ts
const profileRef = useRef(loadProfile())
useMemo(() => {
  const p = profileRef.current
  setDraftPoolRestriction([...STARTER_WIZARDS, ...p.unlockedWizards])
  setRelicPoolRestriction([...STARTER_RELICS, ...p.unlockedRelics])
}, [])
```

Add the imports:
```ts
import { loadProfile, saveProfile, markSeen } from '@/lib/metaStore'
import { STARTER_WIZARDS, STARTER_RELICS } from '@/data/unlocks'
import { setDraftPoolRestriction } from '@/game/engine/draft'
import { setRelicPoolRestriction } from '@/game/engine/relics'
```

- [ ] **Step 2: Mark drafted/recruited wizards as seen**

In `completeDraft` and `chooseRecruit`, after computing `next`, persist codex seen for the team's wizards:

```ts
// inside completeDraft, after `const next = confirmDraftPicks(...)`:
let p = profileRef.current
for (const d of next.team) p = markSeen(p, 'wizard', d.wizard.id)
profileRef.current = p; saveProfile(p)
```
Apply the same three lines in `chooseRecruit` (over `next.team`).

- [ ] **Step 3: Mark enemy wizards + boss + synergies seen when a battle is prepared**

In `chooseNode`, when `moved.phase === 'battle'`, after `setBattle(prepareCombat(moved))`, mark the enemy team and any boss/synergies. Derive the enemy from the prepared battle snapshot (`ActiveBattleB.enemy`) — inspect `hooks/useRunB.combat.ts` for the exact field — and:

```ts
let p = profileRef.current
for (const d of preparedBattle.enemy) p = markSeen(p, 'wizard', d.wizard.id)
for (const a of moved.activeSynergies ?? []) p = markSeen(p, 'synergy', a.synergy.id)
profileRef.current = p; saveProfile(p)
```

- [ ] **Step 4: Verify end-to-end in the app**

Run the app (use the `run` skill) and start a new run. Confirm the draft/recruit only offers starter-set wizards, that the game is playable, and (via devtools → Application → Local Storage) that `harry:profile:v1` gains `codex.wizardsSeen` entries as you draft and fight.

- [ ] **Step 5: Typecheck + full test run**

Run: `npx tsc --noEmit && npx vitest run`
Expected: clean typecheck, all tests green.

- [ ] **Step 6: Commit**

```bash
git add hooks/useRunB.ts
git commit -m "feat(meta): apply pool restriction + codex tracking at run start"
```

---

## Task 6: Light seeded boss pool (Reservation 2)

Add one alternate boss per area, picked per-run by seed, reusing calibrated numbers.

**Files:**
- Modify: `data/bosses.ts`, `game/engine/combat/battlePackage.ts:41-64,81-89`
- Test: `tests/engine/combat/bossPool.test.ts`

**Interfaces:**
- Consumes: `BossDef`, `generateBossTeam`, the `(seed, area)` RNG fork in `battlePackage.ts`.
- Produces: `BOSSES_BY_AREA: BossDef[][]` in `data/bosses.ts`; `battlePackage` picks the area's boss from that pool via a seeded fork.

- [ ] **Step 1: Add alt bosses + the pool to `data/bosses.ts`**

Author one alternate `BossDef` per area, each REUSING the calibrated `budget`/`hpMult`/`unitCount` of that area's default boss, changing only `id`, `name`, `bossWizardId`, and optionally `exclusiveSynergy`. Keep the wall/taunt mechanics identical for the reskin (horizontal). Example for area 1:

```ts
export const BELLATRIX_ALT: BossDef = {
  id: 'dolohov_boss', name: 'Antonin Dolohov',
  budget: 300, hpMult: 0.85, bossWizardId: 'dolohov',
  ignoresTaunt: true, pinnedArea: 1, unitCount: 3,
}
```
Then declare the pools (default boss first in each so it is always available):
```ts
export const BOSSES_BY_AREA: BossDef[][] = [
  [MURO, /* MURO_ALT */],
  [BELLATRIX, BELLATRIX_ALT],
  [BOSSES[0]!, /* VOLDEMORT_ALT */],
]
```

- [ ] **Step 2: Write the failing determinism test**

```ts
// tests/engine/combat/bossPool.test.ts
import { describe, it, expect } from 'vitest'
import { buildBattlePackage } from '@/game/engine/combat/battlePackage'
import { BOSSES_BY_AREA } from '@/data/bosses'

describe('seeded boss pool', () => {
  it('picks a boss from the area pool, deterministically per seed', () => {
    const a = buildBattlePackage('seed-A', 1, 4, 'boss')
    const b = buildBattlePackage('seed-A', 1, 4, 'boss')
    expect(a.preview.bossName).toBe(b.preview.bossName) // deterministic
    const names = BOSSES_BY_AREA[1]!.map(x => x.name)
    expect(names).toContain(a.preview.bossName)
  })
  it('different seeds can select different area-1 bosses', () => {
    const seeds = Array.from({ length: 20 }, (_, i) => `s-${i}`)
    const picked = new Set(seeds.map(s => buildBattlePackage(s, 1, 4, 'boss').preview.bossName))
    expect(picked.size).toBeGreaterThan(1) // pool actually varies
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/engine/combat/bossPool.test.ts`
Expected: FAIL — boss selection is still the hardcoded singletons.

- [ ] **Step 4: Seeded pick in `battlePackage.ts`**

Replace the hardcoded `MURO` / `BELLATRIX` / `BOSSES[0]` references in the boss branches (lines 41-64) with a seeded pick from `BOSSES_BY_AREA[area]`. Add a dedicated fork so the choice is stable and independent of enemy/relic forks:

```ts
import { BOSSES_BY_AREA } from '@/data/bosses'
// ...
const bossPick = (): BossDef => {
  const pool = BOSSES_BY_AREA[area] ?? [BOSSES[0]!]
  const idx = combatFork.fork(9001).int(0, pool.length - 1)
  return pool[idx]!
}
```
In each boss branch, call `const boss = bossPick()` and use `boss` in `generateBossTeam(enemyRng, boss)`, `boss.exclusiveSynergy`, `boss.unitDamageReduction`, `boss.ignoresTaunt`. Update the `preview.bossName`/`bossHint` (lines 83-88) to read from the picked `boss` (name from `boss.name`; hint keyed off `boss.unitDamageReduction != null` / `boss.ignoresTaunt`). Verify `Rng` exposes `int(min, max)` (used by the existing enemy generation); if the method name differs, match the real API.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/engine/combat/bossPool.test.ts`
Expected: PASS.

- [ ] **Step 6: Re-run the balance gates (alt bosses reuse calibrated numbers → floor must hold)**

Run: `npx vitest run tests/engine/campaignBalanceB.test.ts tests/engine/campaignBalanceRestricted.test.ts`
Expected: PASS. If the floor drops, an alt boss is not truly power-equal — re-align its `budget`/`hpMult`/`bossWizardId` to the default's and re-run.

- [ ] **Step 7: Full test run + typecheck**

Run: `npx tsc --noEmit && npx vitest run`
Expected: all green. (Note: `RunBRunner.tsx:77` and `ResultScreen` still read `BOSSES[0]` for the final-boss title — confirm those still render a correct name; if the final area now varies, thread the picked boss name through the battle snapshot instead.)

- [ ] **Step 8: Commit**

```bash
git add data/bosses.ts game/engine/combat/battlePackage.ts tests/engine/combat/bossPool.test.ts
git commit -m "feat(meta): seeded boss pool — one alternate boss per area"
```

---

## Task 7: Fire run-end recording (`hooks/useRunB.ts`)

When the run reaches `win`/`defeat`, compute the summary once, record it to the profile, and expose the result to the ceremony.

**Files:**
- Modify: `hooks/useRunB.ts`

**Interfaces:**
- Consumes: `buildRunEndSummary`, `recordRunEnd` (Task 2); `markSeen`/`saveProfile` (Task 1); the picked boss ids for `unlockBoss`/codex (Task 6).
- Produces: adds `runReward: RunReward | null` to `RunBController`, where `interface RunReward { earned: number; unlocked: UnlockTarget[]; profile: MetaProfile }`.

- [ ] **Step 1: Compute + persist the reward exactly once on entering win/defeat**

Add state `const [runReward, setRunReward] = useState<RunReward | null>(null)`. In `commit`, after `setView`, detect the terminal transition and record it once:

```ts
const commit = useCallback((next: RunState, v?: RunBView) => {
  runRef.current = next; setRunState(next); saveRun(next)
  const view = v ?? viewForPhase(next.phase)
  setView(view)
  if ((view === 'win' || view === 'defeat') && !rewardFiredRef.current) {
    rewardFiredRef.current = true
    const summary = buildRunEndSummary(next)
    const res = recordRunEnd(profileRef.current, summary)
    profileRef.current = res.profile; saveProfile(res.profile)
    setRunReward({ earned: res.earned, unlocked: res.unlocked, profile: res.profile })
  }
}, [])
```
Add `const rewardFiredRef = useRef(false)` and reset it in `restart` (`rewardFiredRef.current = false; setRunReward(null)`).

- [ ] **Step 2: Expose `runReward` on the controller**

Add `runReward` to the `RunBController` interface and to the returned object.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Verify once-only firing in the app**

Run the app, lose a run on purpose. Confirm `harry:profile:v1` `stats.runsPlayed` increments by exactly 1 (not on every re-render), and `cioccorane` increases by the loss floor.

- [ ] **Step 5: Commit**

```bash
git add hooks/useRunB.ts
git commit -m "feat(meta): record currency + unlocks once on run end"
```

---

## Task 8: End-of-run ceremony (`components/screens/ResultScreen.tsx`)

Turn the bare "Nuova run" into the reward scene: currency tally, unlock reveals, lifetime-stat deltas.

**Files:**
- Modify: `components/screens/ResultScreen.tsx`, `components/screens/RunBRunner.tsx:158-178`

**Interfaces:**
- Consumes: `runReward` (Task 7).

- [ ] **Step 1: Extend `ResultScreen` props**

Add an optional `reward` prop:
```ts
reward?: { earned: number; unlocked: { kind: 'wizard' | 'relic'; id: string; label: string }[]; profile: import('@/lib/metaStore').MetaProfile } | null
```

- [ ] **Step 2: Render the reward block**

Between the seed frame and the "Nuova run" button, add (guarded by `reward`): a Cioccorane line (`+{reward.earned} 🍫`, animated), the balance (`reward.profile.cioccorane`), an unlock list (`reward.unlocked.map(u => u.label)` under a "Nuovo sblocco!" heading, or nothing if empty), and a stats row (`run #{profile.stats.runsPlayed}`, `boss sconfitti {profile.stats.bossesKilled}`, `miglior area {profile.stats.bestStageReached}`). Match the existing framer-motion cadence (stagger with the `beat` multiplier).

- [ ] **Step 3: Add the "Collezione" button + pass `reward` through**

In `RunBRunner.tsx` `win`/`defeat` cases, pass `reward={c.runReward}` and add an `onCollection` callback (opens the hub — wired in Task 9). In `ResultScreen`, render a secondary `Button` "Collezione" next to "Nuova run".

- [ ] **Step 4: Verify in the app**

Run the app, finish a run (win and loss), confirm the currency tally, any unlock reveal, and stats render, and that "Nuova run" still restarts.

- [ ] **Step 5: Typecheck + commit**

```bash
npx tsc --noEmit
git add components/screens/ResultScreen.tsx components/screens/RunBRunner.tsx
git commit -m "feat(meta): end-of-run reward ceremony"
```

---

## Task 9: Collection / hub screen (`components/screens/CollectionScreen.tsx`)

The completionist surface: currency, the wizard/relic collection grid with locked/seen states, and lifetime stats. Reachable from the menu and the result screen.

**Files:**
- Create: `components/screens/CollectionScreen.tsx`
- Modify: the menu screen (`components/screens/MenuScreen.tsx` or the component that renders the main menu) to add a "Collezione" entry; `RunBRunner.tsx` to route `onCollection`.

**Interfaces:**
- Consumes: `loadProfile`, `saveProfile`, `spendCioccorane`, `unlockWizard`, `unlockRelic` (Task 1); `STARTER_WIZARDS`, `STARTER_RELICS`, `UNLOCK_COSTS`, `MILESTONES` (Task 2); `WIZARDS` (`@/data/wizards`), `RELICS` (`@/data/relics`).

- [ ] **Step 1: Build the read-only collection view**

Create `CollectionScreen` (client component). For each wizard in `WIZARDS`, compute status: `unlocked` (in `STARTER_WIZARDS ∪ profile.unlockedWizards`), else `seen` (in `profile.codex.wizardsSeen`), else `hidden`. Render a grid: unlocked = full card; seen = greyed with name + the unlock hint (the milestone label whose `unlock.id` matches, or `compra: {UNLOCK_COSTS.wizard} 🍫`); hidden = silhouette with `???` + the same hint. Show a header with `profile.cioccorane` and a lifetime-stats panel (`runsPlayed`, `runsWon`, `bossesKilled`, `bestStageReached`). Follow existing screen styling (`Frame`, `Button`, Tailwind, framer-motion) — load the `frontend-design` skill first if the visual treatment needs care.

- [ ] **Step 2: Add the purchase action**

A locked entry with an affordable price shows a "Sblocca ({cost} 🍫)" button. On click: `const spent = spendCioccorane(profile, cost); if (spent) { const next = unlockWizard(spent, id); saveProfile(next); setProfile(next) }`. Disable the button when `profile.cioccorane < cost`.

- [ ] **Step 3: Route it from the menu and result screen**

Add a "Collezione" button to the main menu that mounts `CollectionScreen` with an `onBack`. Wire `RunBRunner`'s `onCollection` (Task 8) to surface it (e.g. lift a `showCollection` state to the parent that renders `RunBRunner`, or route via the app's existing screen switch). Confirm both entry points open and "Indietro" returns.

- [ ] **Step 4: Verify in the app**

Run the app. From the menu, open Collezione: confirm ~20 wizards show unlocked and the rest locked with hints; earn currency by finishing a run; return to Collezione and buy a locked wizard; start a new run and confirm the purchased wizard can now be drafted.

- [ ] **Step 5: Typecheck + full test run + commit**

```bash
npx tsc --noEmit && npx vitest run
git add components/screens/CollectionScreen.tsx components/screens/MenuScreen.tsx components/screens/RunBRunner.tsx
git commit -m "feat(meta): collection/hub screen with unlock shop + lifetime stats"
```

---

## Final verification

- [ ] **Full suite green:** `npx tsc --noEmit && npx vitest run` — all tests pass, including both balance gates.
- [ ] **End-to-end playthrough** (use the `verify` skill): a new profile starts with the restricted pool; finishing runs earns Cioccorane and fires at least one milestone unlock within a few runs; the collection screen reflects unlocks and codex "seen" state; a purchased wizard becomes draftable; boss encounters vary across seeds.
- [ ] **No regressions:** existing run flow (draft → map → battle → victory → area-cleared → win/defeat → restart) still works, and `harry:run:v1` resume is unaffected.

---

## Self-review notes (author → reviewer)

- **Reservation 1** is enforced by Task 3 as a CI gate (the plan explicitly says: do not build UI until it passes; fallback is a gentler lock, a user decision).
- **Reservation 2** is Task 6 and reuses calibrated numbers; Task 6 Step 6 re-runs the balance gates.
- **Two ids to verify against real data before finishing:** the named-synergy ids in `metaProgress.ts` `NAMED_SYNERGY_IDS` (check `data/synergies.ts`), and the example locked ids in `MILESTONES` (must be real, non-starter ids).
- **One field to confirm:** `ActiveBattleB.enemy` shape in `hooks/useRunB.combat.ts` (Task 5 Step 3) and `Rng.int(min,max)` existence (Task 6 Step 4) — both used by existing code, matched to the real API when wiring.
