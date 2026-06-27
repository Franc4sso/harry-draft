# Run Progression — Piano C: Integrazione UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the new roguelite loop (Plan A engine + Plan B integration) actually playable in the browser — House select → pick 2 starters → route a per-area atlas → fight/recruit/relic/level-up → clear 3 areas → final boss — with autosave and a "Continua run" entry, then retire the legacy draft-5/`nextBattle` loop.

**Architecture:** A new FSM hook `useRunB` drives `runEngine` (Plan B) and renders one screen per `RunState.phase`. New screens are additive React components reusing existing primitives (`WizardCard`, `RelicCard`, `SquadPanel`, `GlowPanel`, `Button`, house theming). Combat is shown by computing the pure `resolveCombat` snapshot for the replay, then committing the transition via `resolveCurrent` with the **same forked rng** (deterministic, identical result). Autosave persists every transition via `runStore` (Plan B). Once the new path is wired and the entry flipped, the legacy `DraftScreen`/`PlayFlow` draft branch, legacy `useRun`, and `run.ts` loop functions (`startRun`/`confirmTeam`/`nextBattle`/`advanceToNode`) + the superseded `campaignBalance.test.ts` are removed.

**Tech Stack:** Next.js (App Router), React 18 client components, TypeScript, Tailwind v4, Framer Motion, Vitest + @testing-library/react + jsdom.

## Global Constraints

- **Engine boundary:** do NOT modify `game/engine/combat/*`. The UI consumes the pure engine only. Levels reach combat through `battleReadyTeam`/`resolveCombat` exactly as Plan B established.
- **Determinism:** every generation/combat call uses a forked `Rng` derived from `seed` (no `Math.random`/`Date.now`). The battle snapshot (`resolveCombat`) and the commit (`resolveCurrent`) MUST receive the same forked rng so the replayed result equals the committed result.
- **Reuse, don't duplicate:** reuse `runEngine` (`startRunB`/`starterOffer`/`chooseStarters`/`reachable`/`moveTo`/`resolveCurrent`/`applyLevelUp`/`clearAreaAndAdvance`/`registerCoreResolvers`/`phaseAfterNode`), `resolveCombat` (`resolvers/combat`), `recruitOffer`/`relicOffer` (`resolvers/recruit`), `battleReadyTeam`, `statBreakdown`, `runStore` (`saveRun`/`loadRun`/`clearRun`), `detectSynergies`, and existing UI: `BattleScreen`, `VictoryScreen`, `ResultScreen`, `WizardCard`, `WizardCardRow`, `RelicCard`, `SquadPanel`, `SynergyTracker`, `GlowPanel`, `Button`, `Chip`, `HouseCrest`, `HOUSES`, `houseTheme`, `displayName`.
- **Additive until the flip:** new files/screens are added alongside the legacy loop; the suite stays green at every commit. Only Tasks 10–11 change the entry point and delete legacy code.
- **Test runner:** `npx vitest run <path>` from repo root (Windows; use the Bash tool for `npx`). `npx tsc --noEmit` clean and `npx vitest run` green after every task.
- **Styling:** 100% Tailwind + inline `style` for dynamic house colors; wrap panels in `.glass`/`GlowPanel`; entrance/hover via Framer Motion; respect `prefers-reduced-motion` (inherited from globals.css). No CSS modules.
- **Italian copy:** all player-facing strings in Italian, matching existing screens ("Scegli il tuo cammino", "Sfida X di Y", etc.).

## Existing signatures this plan integrates with (verbatim)

- `startRunB(seed): RunState` (phase `'house'`); `starterOffer(seed, house): DraftedWizard[]`; `chooseStarters(state, house, starterIds, rng): RunState` (→ phase `'map'`); `reachable(state): RunNode[]`; `moveTo(state, nodeId): RunState` (→ phase `'battle'|'recruit-node'|'relic-node'`); `resolveCurrent(state, choice, rng): RunState`; `applyLevelUp(state, wizardId, choice): RunState`; `clearAreaAndAdvance(state, rng): RunState`; `registerCoreResolvers(): void`; `phaseAfterNode({isBoss,area,areas,wiped,hasPending}): RunPhase` — all `game/engine/runEngine.ts`.
- `resolveCombat(state, node, rng): CombatResult` where `CombatResult = { result: BattleResult; enemy: DraftedWizard[]; enemySyn: ActiveSynergy[]; isBoss: boolean; survivors: DraftedWizard[]; expEach: number; milestones: {wizardId; level}[] }` — `game/engine/resolvers/combat.ts`.
- `recruitOffer(state, node, rng): DraftedWizard[]`; `relicOffer(state, node, rng): Relic[]` — `game/engine/resolvers/recruit.ts`.
- `ResolverChoice = { kind:'recruit-pick'; wizardId; replaceId? } | { kind:'relic-pick'; relicId } | { kind:'combat-ack' } | { kind:'skip' }` — `game/engine/resolvers/types.ts`.
- `battleReadyTeam(team): DraftedWizard[]` — `game/engine/battlePrep.ts`.
- `statBreakdown(dw, team, synergies, relics): { base; afterLevel; afterSynergy; total }` — `lib/statBreakdown.ts`.
- `saveRun(state): void`; `loadRun(): RunState | null`; `clearRun(): void`; `RUN_KEY` — `lib/runStore.ts`.
- `parseAreaNodeId(id): { area; floor; idx }` — `game/engine/map.ts`. NOTE: `nodeDepth(id)` only parses legacy `f{n}n{n}` ids and THROWS on area ids `a{n}f{n}n{n}` — new screens must use `parseAreaNodeId`.
- `HOUSES: Record<House,{id;label;color;glow}>` — `data/houses.ts`. `houseTheme(house)` — `lib/houseTheme` (border/glow). `GrowthChoice = { atLevel: number; kind: 'atk'|'def'|'spd'|'hp' }`.
- `BattleScreen` props: `{ result; playerTeam; playerSyn; playerRelics?; enemy; enemySyn; title; rightTitle; onFinish }`. `VictoryScreen` props: `{ result; mvpName; battleNumber; enemyCount; bossNext; onNext; fallenNames? }`. `ResultScreen` props: `{ outcome:'win'|'defeat'; seed; stageReached; enemyCount; onRestart }`.

---

## File Structure

| File | Responsibility |
|---|---|
| `hooks/useRunB.ts` (new) | FSM controller over `runEngine`: derives `view` from `RunState.phase`, exposes actions (selectHouse/confirmStarters/chooseNode/commitBattle/chooseRecruit/chooseRelic/applyGrowth/advanceArea/restart), autosaves each transition, resumes from `runStore`. |
| `hooks/useRunB.combat.ts` (new) | `prepareCombat(run, rng)`/`combatRng(run)` helpers: build the `ActiveBattleB` replay snapshot from `resolveCombat` and the matching commit rng. Keeps the snapshot/commit determinism in one place. |
| `components/screens/HouseSelectScreen.tsx` (new) | Phase `'house'`: pick 1 of 4 Houses. |
| `components/screens/StarterPickScreen.tsx` (new) | Phase `'starter'`: pick exactly 2 wizards from the chosen House's offer. |
| `components/screens/RecruitScreen.tsx` (new) | Phase `'recruit-node'`: choose 1 of 3 recruits (replace lowest if full). |
| `components/screens/RelicNodeScreen.tsx` (new) | Phase `'relic-node'`: choose 1 of 3 relics. |
| `components/screens/LevelUpScreen.tsx` (new) | Phase `'levelup'`: resolve one pending milestone (atk/def/spd/hp) with stat-layer preview. |
| `components/screens/AreaClearedScreen.tsx` (new) | Phase `'area-cleared'`: interstitial → advance to next area. |
| `components/screens/MapScreen.tsx` (modify) | Use `parseAreaNodeId().floor` (not `nodeDepth`); show area label + resolved styling. |
| `components/screens/RunBRunner.tsx` (new) | Orchestrator: `useRunB` → one screen per view, with `AnimatePresence` crossfade. Replaces `CampaignRunner` for the new loop. |
| `components/screens/PlayFlow.tsx` (modify, Task 10) | Render `RunBRunner` (resume-aware) instead of the legacy draft→CampaignRunner path. |
| `components/screens/MenuScreen.tsx` (modify, Task 10) | Add "Continua run" when a saved run exists. |
| `lib/runSummary.ts` (new) | Pure helpers for end-of-run / area-cleared display (areas cleared, roster levels). |
| Deletions (Task 11) | `components/screens/DraftScreen.tsx`, legacy `hooks/useRun.ts`, legacy loop fns in `game/engine/run.ts`, `tests/engine/campaignBalance.test.ts`, `game/engine/draftSession.ts` build-5 path (if unused). |

---

## Task 1: `useRunB` FSM hook + combat helper

**Files:**
- Create: `hooks/useRunB.combat.ts`
- Create: `hooks/useRunB.ts`
- Test: `tests/hooks/useRunB.test.ts`

**Interfaces:**
- Consumes: all of `runEngine`, `resolveCombat`, `battleReadyTeam`, `detectSynergies`, `saveRun`/`loadRun`/`clearRun`, `createRng`, `BALANCE`.
- Produces:
  - In `useRunB.combat.ts`:
    ```ts
    export interface ActiveBattleB {
      result: BattleResult; enemy: DraftedWizard[]; enemySyn: ActiveSynergy[]
      isBoss: boolean; playerTeam: DraftedWizard[]; playerSyn: ActiveSynergy[]
    }
    export function combatRng(run: RunState): Rng   // deterministic per (seed, area, floor)
    export function prepareCombat(run: RunState): ActiveBattleB
    ```
  - In `useRunB.ts`:
    ```ts
    export type RunBView =
      | 'house' | 'starter' | 'map' | 'battle' | 'victory'
      | 'levelup' | 'recruit' | 'relic' | 'area-cleared' | 'win' | 'defeat'
    export interface RunBController {
      run: RunState
      view: RunBView
      house: House | null            // chosen during 'house' → 'starter'
      starterOffer: DraftedWizard[]  // [] until a house is chosen
      battle: ActiveBattleB | null
      reachable: RunNode[]
      currentNode: RunNode | undefined
      area: number
      areasTotal: number
      pendingLevelUp: PendingLevelUp | null
      lastFallen: string[]
      // actions
      selectHouse: (house: House) => void                 // 'house' → 'starter'
      backToHouse: () => void                             // 'starter' → 'house'
      confirmStarters: (starterIds: string[]) => void     // 'starter' → 'map'
      chooseNode: (nodeId: string) => void                // 'map' → battle/recruit/relic
      commitBattle: () => void                            // 'battle' → victory/levelup/area-cleared/win/defeat
      acknowledgeVictory: () => void                      // 'victory' → 'map'
      chooseRecruit: (wizardId: string, replaceId?: string) => void  // 'recruit' → 'map'
      chooseRelic: (relicId: string) => void              // 'relic' → 'map'
      applyGrowth: (choice: GrowthChoice) => void         // 'levelup' → levelup/victory/area-cleared/win
      advanceArea: () => void                             // 'area-cleared' → 'map'
      restart: () => void                                 // clear save → 'house'
    }
    export function useRunB(seed: string): RunBController
    ```

**Design notes (read before coding):**
- `view` is derived from `run.phase`, EXCEPT: `'house'` may advance to a local `'starter'` view after `selectHouse` (the engine has no `chooseStarters`-precursor; the hook owns house→starter). And after resolving a **recruit/relic** node, `resolveCurrent` returns phase `'victory'` (non-boss) — the hook shortcuts straight to `'map'` (no victory interstitial for non-combat nodes). Combat victory DOES show `'victory'`.
- Battle: on `chooseNode` into a combat node, store `prepareCombat(run)` as `battle`. `commitBattle` runs `resolveCurrent(run, {kind:'combat-ack'}, combatRng(run))` (same rng → identical result), computes `lastFallen` (entered roster minus survivors), saves, and sets view from the new phase.
- Autosave: call `saveRun(next)` after every state mutation. `restart` calls `clearRun()`.
- Resume: `useRunB` initializes from `loadRun() ?? startRunB(seed)`. `registerCoreResolvers()` is called once at module load (idempotent).
- `pendingLevelUp` = `run.pendingLevelUps?.[0] ?? null`.

- [ ] **Step 1: Write `useRunB.combat.ts`**

```ts
import type { ActiveSynergy, BattleResult, DraftedWizard, RunState } from '@/types'
import type { Rng } from '@/game/engine/rng'
import { createRng } from '@/game/engine/rng'
import { resolveCombat } from '@/game/engine/resolvers/combat'
import { battleReadyTeam } from '@/game/engine/battlePrep'
import { detectSynergies } from '@/game/engine/synergy'
import { parseAreaNodeId } from '@/game/engine/map'

export interface ActiveBattleB {
  result: BattleResult
  enemy: DraftedWizard[]
  enemySyn: ActiveSynergy[]
  isBoss: boolean
  playerTeam: DraftedWizard[]
  playerSyn: ActiveSynergy[]
}

const combatChannel = 2

/** Deterministic rng for the current combat node; shared by snapshot + commit. */
export function combatRng(run: RunState): Rng {
  const node = run.map!.find(n => n.id === run.currentNodeId)!
  const { area, floor } = parseAreaNodeId(node.id)
  return createRng(run.seed).fork(combatChannel).fork(area).fork(floor)
}

/** Build the replay snapshot: the leveled roster that fought + the pure result. */
export function prepareCombat(run: RunState): ActiveBattleB {
  const node = run.map!.find(n => n.id === run.currentNodeId)!
  const out = resolveCombat(run, node, combatRng(run))
  const ready = battleReadyTeam(run.team)
  return {
    result: out.result, enemy: out.enemy, enemySyn: out.enemySyn, isBoss: out.isBoss,
    playerTeam: ready, playerSyn: detectSynergies(ready),
  }
}
```

- [ ] **Step 2: Write the failing test**

Create `tests/hooks/useRunB.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRunB } from '@/hooks/useRunB'
import { starterOffer } from '@/game/engine/runEngine'
import { clearRun } from '@/lib/runStore'

beforeEach(() => { try { clearRun() } catch {} ; localStorage.clear() })

describe('useRunB FSM', () => {
  it('starts at house selection with an empty team', () => {
    const { result } = renderHook(() => useRunB('seed-c'))
    expect(result.current.view).toBe('house')
    expect(result.current.run.team).toHaveLength(0)
  })

  it('house → starter exposes the chosen house offer', () => {
    const { result } = renderHook(() => useRunB('seed-c'))
    act(() => result.current.selectHouse('Grifondoro'))
    expect(result.current.view).toBe('starter')
    expect(result.current.house).toBe('Grifondoro')
    expect(result.current.starterOffer.every(d => d.wizard.house === 'Grifondoro')).toBe(true)
  })

  it('confirmStarters builds a 2-wizard team and enters the map', () => {
    const { result } = renderHook(() => useRunB('seed-c'))
    act(() => result.current.selectHouse('Grifondoro'))
    const ids = result.current.starterOffer.slice(0, 2).map(d => d.wizard.id)
    act(() => result.current.confirmStarters(ids))
    expect(result.current.view).toBe('map')
    expect(result.current.run.team).toHaveLength(2)
    expect(result.current.reachable.length).toBeGreaterThan(0)
  })

  it('resuming reads a saved run instead of restarting', () => {
    const first = renderHook(() => useRunB('seed-c'))
    act(() => first.result.current.selectHouse('Corvonero'))
    const ids = first.result.current.starterOffer.slice(0, 2).map(d => d.wizard.id)
    act(() => first.result.current.confirmStarters(ids))
    // a fresh hook on the same key resumes mid-run
    const second = renderHook(() => useRunB('seed-c'))
    expect(second.result.current.view).toBe('map')
    expect(second.result.current.run.team).toHaveLength(2)
  })

  it('restart clears the save and returns to house', () => {
    const { result } = renderHook(() => useRunB('seed-c'))
    act(() => result.current.selectHouse('Serpeverde'))
    act(() => result.current.restart())
    expect(result.current.view).toBe('house')
    expect(result.current.run.team).toHaveLength(0)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/hooks/useRunB.test.ts`
Expected: FAIL ("does not provide an export named 'useRunB'")

- [ ] **Step 4: Implement `hooks/useRunB.ts`**

```ts
'use client'
import { useState, useRef, useCallback, useMemo } from 'react'
import type { DraftedWizard, GrowthChoice, House, PendingLevelUp, RunNode, RunState } from '@/types'
import {
  startRunB, starterOffer as engineStarterOffer, chooseStarters, reachable as engineReachable,
  moveTo, resolveCurrent, applyLevelUp, clearAreaAndAdvance, registerCoreResolvers,
} from '@/game/engine/runEngine'
import { createRng } from '@/game/engine/rng'
import { saveRun, loadRun, clearRun } from '@/lib/runStore'
import { BALANCE } from '@/data/constants'
import { prepareCombat, combatRng, type ActiveBattleB } from './useRunB.combat'

registerCoreResolvers()

export type RunBView =
  | 'house' | 'starter' | 'map' | 'battle' | 'victory'
  | 'levelup' | 'recruit' | 'relic' | 'area-cleared' | 'win' | 'defeat'

export interface RunBController {
  run: RunState; view: RunBView; house: House | null; starterOffer: DraftedWizard[]
  battle: ActiveBattleB | null; reachable: RunNode[]; currentNode: RunNode | undefined
  area: number; areasTotal: number; pendingLevelUp: PendingLevelUp | null; lastFallen: string[]
  selectHouse: (house: House) => void
  backToHouse: () => void
  confirmStarters: (starterIds: string[]) => void
  chooseNode: (nodeId: string) => void
  commitBattle: () => void
  acknowledgeVictory: () => void
  chooseRecruit: (wizardId: string, replaceId?: string) => void
  chooseRelic: (relicId: string) => void
  applyGrowth: (choice: GrowthChoice) => void
  advanceArea: () => void
  restart: () => void
}

const viewForPhase = (p: RunState['phase']): RunBView => {
  switch (p) {
    case 'house': return 'house'
    case 'map': return 'map'
    case 'battle': return 'battle'
    case 'victory': return 'victory'
    case 'levelup': return 'levelup'
    case 'recruit-node': return 'recruit'
    case 'relic-node': return 'relic'
    case 'area-cleared': return 'area-cleared'
    case 'win': return 'win'
    case 'defeat': return 'defeat'
    default: return 'map'
  }
}

export function useRunB(seed: string): RunBController {
  const [run, setRunState] = useState<RunState>(() => loadRun() ?? startRunB(seed))
  const [view, setView] = useState<RunBView>(() => viewForPhase((loadRun() ?? startRunB(seed)).phase))
  const [house, setHouse] = useState<House | null>(() => (loadRun()?.house ?? null))
  const [battle, setBattle] = useState<ActiveBattleB | null>(null)
  const [lastFallen, setLastFallen] = useState<string[]>([])
  const runRef = useRef(run); runRef.current = run

  const commit = useCallback((next: RunState, v?: RunBView) => {
    runRef.current = next; setRunState(next); saveRun(next)
    setView(v ?? viewForPhase(next.phase))
  }, [])

  const selectHouse = useCallback((h: House) => { setHouse(h); setView('starter') }, [])
  const backToHouse = useCallback(() => { setHouse(null); setView('house') }, [])

  const confirmStarters = useCallback((ids: string[]) => {
    const next = chooseStarters(runRef.current, house!, ids, createRng(runRef.current.seed))
    commit(next, 'map')
  }, [house, commit])

  const chooseNode = useCallback((nodeId: string) => {
    const moved = moveTo(runRef.current, nodeId)
    if (moved.phase === 'battle') {
      runRef.current = moved
      setBattle(prepareCombat(moved))
      commit(moved, 'battle')
    } else {
      commit(moved) // recruit-node | relic-node
    }
  }, [commit])

  const commitBattle = useCallback(() => {
    const before = runRef.current.team
    const next = resolveCurrent(runRef.current, { kind: 'combat-ack' }, combatRng(runRef.current))
    const surviving = new Set(next.team.map(d => d.wizard.id))
    setLastFallen(before.filter(d => !surviving.has(d.wizard.id)).map(d => d.wizard.name))
    commit(next)
  }, [commit])

  const acknowledgeVictory = useCallback(() => { commit({ ...runRef.current, phase: 'map' }, 'map') }, [commit])

  const chooseRecruit = useCallback((wizardId: string, replaceId?: string) => {
    const next = resolveCurrent(runRef.current, { kind: 'recruit-pick', wizardId, replaceId }, createRng(runRef.current.seed))
    commit({ ...next, phase: 'map' }, 'map') // non-combat node: straight back to map
  }, [commit])

  const chooseRelic = useCallback((relicId: string) => {
    const next = resolveCurrent(runRef.current, { kind: 'relic-pick', relicId }, createRng(runRef.current.seed))
    commit({ ...next, phase: 'map' }, 'map')
  }, [commit])

  const applyGrowth = useCallback((choice: GrowthChoice) => {
    const p = runRef.current.pendingLevelUps?.[0]
    if (!p) return
    commit(applyLevelUp(runRef.current, p.wizardId, choice))
  }, [commit])

  const advanceArea = useCallback(() => { commit(clearAreaAndAdvance(runRef.current, createRng(runRef.current.seed))) }, [commit])

  const restart = useCallback(() => {
    clearRun(); const fresh = startRunB(seed)
    setHouse(null); setBattle(null); setLastFallen([]); commit(fresh, 'house')
  }, [seed, commit])

  const offer = useMemo(() => (house ? engineStarterOffer(run.seed, house) : []), [house, run.seed])
  const reachable = useMemo(() => engineReachable(run), [run])
  const currentNode = run.map?.find(n => n.id === run.currentNodeId)

  return {
    run, view, house, starterOffer: offer, battle, reachable, currentNode,
    area: run.area ?? 0, areasTotal: BALANCE.map.areas, pendingLevelUp: run.pendingLevelUps?.[0] ?? null, lastFallen,
    selectHouse, backToHouse, confirmStarters, chooseNode, commitBattle, acknowledgeVictory,
    chooseRecruit, chooseRelic, applyGrowth, advanceArea, restart,
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/hooks/useRunB.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 6: tsc + full suite** → `npx tsc --noEmit` exit 0; `npx vitest run` green

- [ ] **Step 7: Commit**

```bash
git add hooks/useRunB.ts hooks/useRunB.combat.ts tests/hooks/useRunB.test.ts
git commit -m "feat(run-ui): useRunB FSM hook over runEngine (autosave + resume)"
```

---

## Task 2: HouseSelectScreen

**Files:**
- Create: `components/screens/HouseSelectScreen.tsx`
- Test: `tests/screens/HouseSelectScreen.test.tsx`

**Interfaces:**
- Consumes: `HOUSES` (`@/data/houses`), `Button`, `GlowPanel`, `HouseCrest`.
- Produces: `HouseSelectScreen(props: { onSelect: (house: House) => void }): JSX.Element` — renders the 4 Houses as themed buttons; clicking calls `onSelect(house)`.

- [ ] **Step 1: Write the failing test**

Create `tests/screens/HouseSelectScreen.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HouseSelectScreen } from '@/components/screens/HouseSelectScreen'

describe('HouseSelectScreen', () => {
  it('renders the 4 houses and reports the chosen one', async () => {
    const onSelect = vi.fn()
    render(<HouseSelectScreen onSelect={onSelect} />)
    for (const label of ['Grifondoro', 'Serpeverde', 'Corvonero', 'Tassorosso']) {
      expect(screen.getByRole('button', { name: new RegExp(label) })).toBeInTheDocument()
    }
    await userEvent.click(screen.getByRole('button', { name: /Corvonero/ }))
    expect(onSelect).toHaveBeenCalledWith('Corvonero')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/screens/HouseSelectScreen.test.tsx`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement `components/screens/HouseSelectScreen.tsx`**

```tsx
'use client'
import { motion } from 'framer-motion'
import type { House } from '@/types'
import { HOUSES } from '@/data/houses'
import { HouseCrest } from '@/components/ui/HouseCrest'

export function HouseSelectScreen({ onSelect }: { onSelect: (house: House) => void }) {
  return (
    <main className="flex-1 flex flex-col items-center justify-center gap-8 p-8">
      <h1 className="font-display text-4xl text-center">Scegli la tua Casa</h1>
      <p className="text-white/60 text-center max-w-md">
        La tua Casa guida i reclutamenti: ogni terna garantisce almeno un mago della tua Casa.
      </p>
      <div className="grid grid-cols-2 gap-5 max-w-2xl w-full">
        {Object.values(HOUSES).map((h, i) => (
          <motion.button
            key={h.id}
            onClick={() => onSelect(h.id)}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            whileHover={{ y: -4, scale: 1.02 }}
            className="glass rounded-xl p-6 flex flex-col items-center gap-3 border"
            style={{ borderColor: h.color, boxShadow: `0 0 24px -8px ${h.glow}` }}
          >
            <HouseCrest house={h.id} size={48} />
            <span className="font-display text-2xl">{h.label}</span>
          </motion.button>
        ))}
      </div>
    </main>
  )
}
```

- [ ] **Step 4: Run test to verify it passes** → `npx vitest run tests/screens/HouseSelectScreen.test.tsx` PASS (1 test)
- [ ] **Step 5: tsc + full suite** → green
- [ ] **Step 6: Commit**

```bash
git add components/screens/HouseSelectScreen.tsx tests/screens/HouseSelectScreen.test.tsx
git commit -m "feat(run-ui): HouseSelectScreen (4 houses, themed)"
```

---

## Task 3: StarterPickScreen

**Files:**
- Create: `components/screens/StarterPickScreen.tsx`
- Test: `tests/screens/StarterPickScreen.test.tsx`

**Interfaces:**
- Consumes: `WizardCard`, `Button`, `SquadPanel`, `displayName`; `DraftedWizard`.
- Produces: `StarterPickScreen(props: { house: House; offer: DraftedWizard[]; onConfirm: (ids: string[]) => void; onBack: () => void }): JSX.Element` — toggle-select exactly 2 wizards; "Inizia" enabled only at 2 selected; calls `onConfirm([id,id])`.

- [ ] **Step 1: Write the failing test**

Create `tests/screens/StarterPickScreen.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StarterPickScreen } from '@/components/screens/StarterPickScreen'
import { starterOffer } from '@/game/engine/runEngine'

describe('StarterPickScreen', () => {
  it('requires exactly two picks before confirming', async () => {
    const offer = starterOffer('seed-sp', 'Grifondoro')
    const onConfirm = vi.fn()
    render(<StarterPickScreen house="Grifondoro" offer={offer} onConfirm={onConfirm} onBack={() => {}} />)
    const confirm = screen.getByRole('button', { name: /Inizia/ })
    expect(confirm).toBeDisabled()
    await userEvent.click(screen.getByTestId(`pick-${offer[0]!.wizard.id}`))
    await userEvent.click(screen.getByTestId(`pick-${offer[1]!.wizard.id}`))
    expect(confirm).toBeEnabled()
    await userEvent.click(confirm)
    expect(onConfirm).toHaveBeenCalledWith([offer[0]!.wizard.id, offer[1]!.wizard.id])
  })
})
```

- [ ] **Step 2: Run test to verify it fails** → FAIL (module not found)

- [ ] **Step 3: Implement `components/screens/StarterPickScreen.tsx`**

```tsx
'use client'
import { useState } from 'react'
import type { DraftedWizard, House } from '@/types'
import { WizardCard } from '@/components/cards/WizardCard'
import { Button } from '@/components/ui/Button'
import { SquadPanel } from '@/components/draft/SquadPanel'

export function StarterPickScreen({
  house, offer, onConfirm, onBack,
}: {
  house: House
  offer: DraftedWizard[]
  onConfirm: (ids: string[]) => void
  onBack: () => void
}) {
  const [picked, setPicked] = useState<string[]>([])
  const toggle = (id: string) =>
    setPicked(p => p.includes(id) ? p.filter(x => x !== id) : p.length < 2 ? [...p, id] : p)
  const pickedWizards = picked
    .map(id => offer.find(d => d.wizard.id === id))
    .filter((d): d is DraftedWizard => !!d)

  return (
    <main className="flex-1 flex flex-col items-center gap-6 p-6">
      <h1 className="font-display text-3xl">Scegli 2 maghi — {house}</h1>
      <SquadPanel picks={pickedWizards} teamSize={2} layout="row" />
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-w-5xl">
        {offer.map(d => (
          <div key={d.wizard.id} data-testid={`pick-${d.wizard.id}`}>
            <WizardCard drafted={d} selected={picked.includes(d.wizard.id)} onClick={() => toggle(d.wizard.id)} />
          </div>
        ))}
      </div>
      <div className="flex gap-3">
        <Button variant="ghost" onClick={onBack}>Indietro</Button>
        <Button variant="primary" disabled={picked.length !== 2} onClick={() => onConfirm(picked)}>
          Inizia ({picked.length}/2)
        </Button>
      </div>
    </main>
  )
}
```

- [ ] **Step 4: Run test to verify it passes** → PASS (1 test)
- [ ] **Step 5: tsc + full suite** → green
- [ ] **Step 6: Commit**

```bash
git add components/screens/StarterPickScreen.tsx tests/screens/StarterPickScreen.test.tsx
git commit -m "feat(run-ui): StarterPickScreen (pick exactly 2 of house offer)"
```

---

## Task 4: MapScreen — per-area atlas (area ids + area label)

**Files:**
- Modify: `components/screens/MapScreen.tsx`
- Test: `tests/screens/MapScreen.area.test.tsx` (new; keep existing `MapScreen.test.tsx`)

**Interfaces:**
- Consumes: `parseAreaNodeId` (`@/game/engine/map`); existing props `{ map; currentNodeId; reachableIds; onChoose }` PLUS new optional `{ area?: number; areasTotal?: number }`.
- Produces: MapScreen that derives floors via `parseAreaNodeId(id).floor` (works for area ids), shows an "Area X / N" label, and marks `resolved` nodes.

**Background:** `nodeDepth` throws on area ids `a{n}f{n}n{n}`. The screen must use `parseAreaNodeId(id).floor`. Existing `MapScreen.test.tsx` uses legacy `f{n}n{n}` ids; keep it green by making the floor parse tolerant (try area id first, fall back to `nodeDepth`).

- [ ] **Step 1: Write the failing test**

Create `tests/screens/MapScreen.area.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MapScreen } from '@/components/screens/MapScreen'
import { generateArea } from '@/game/engine/map'
import { createRng } from '@/game/engine/rng'

describe('MapScreen with area-scoped ids', () => {
  it('renders area floors and reports the chosen node', async () => {
    const map = generateArea(createRng('m').fork(4).fork(0), 0, { teamSize: 2, teamMax: 5 })
    const entry = map.find(n => n.id.includes('f0n'))!
    const onChoose = vi.fn()
    render(
      <MapScreen map={map} currentNodeId={entry.id} reachableIds={entry.next} area={0} areasTotal={3} onChoose={onChoose} />,
    )
    expect(screen.getByText(/Area 1/)).toBeInTheDocument()
    const target = map.find(n => n.id === entry.next[0])!
    await userEvent.click(screen.getByTestId(`node-${target.id}`))
    expect(onChoose).toHaveBeenCalledWith(target.id)
  })
})
```

- [ ] **Step 2: Run test to verify it fails** → FAIL (nodeDepth throws / no "Area 1" / no testid)

- [ ] **Step 3: Modify `components/screens/MapScreen.tsx`**

Replace the floor-derivation + props with the area-aware version (keep the icon/label maps and styling):

```tsx
'use client'
import type { RunNode, RunNodeType } from '@/types'
import { parseAreaNodeId, nodeDepth } from '@/game/engine/map'

/** Floor index for any node id (area-scoped `a#f#n#` or legacy `f#n#`). */
function floorOf(id: string): number {
  try { return parseAreaNodeId(id).floor } catch { return nodeDepth(id) }
}

const ICON: Record<RunNodeType, string> = {
  battle: '⚔️', elite: '☠️', boss: '👑', relic: '💎', event: '❓', shop: '🛒',
  recruit: '🧙', commonRoom: '🏠', library: '📚', potions: '🧪', forest: '🌲',
}
const LABEL: Record<RunNodeType, string> = {
  battle: 'Battaglia', elite: 'Elite', boss: 'Boss', relic: 'Reliquia', event: 'Evento',
  shop: 'Negozio', recruit: 'Recluta', commonRoom: 'Sala Comune', library: 'Biblioteca',
  potions: 'Pozioni', forest: 'Foresta',
}

export function MapScreen({
  map, currentNodeId, reachableIds, onChoose, area, areasTotal,
}: {
  map: RunNode[]
  currentNodeId: string
  reachableIds: string[]
  onChoose: (nodeId: string) => void
  area?: number
  areasTotal?: number
}) {
  const maxFloor = Math.max(...map.map(n => floorOf(n.id)))
  const reachable = new Set(reachableIds)
  const floors = Array.from({ length: maxFloor + 1 }, (_, f) => map.filter(n => floorOf(n.id) === f))

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6">
      <div className="text-center">
        {area !== undefined && (
          <div className="text-xs uppercase tracking-widest text-gold">
            Area {area + 1}{areasTotal ? ` / ${areasTotal}` : ''}
          </div>
        )}
        <h2 className="text-xl font-bold">Scegli il tuo cammino</h2>
      </div>
      <div className="flex flex-col-reverse gap-8">
        {floors.map((nodes, f) => (
          <div key={f} className="flex justify-center gap-6">
            {nodes.map(n => {
              const isCurrent = n.id === currentNodeId
              const isReachable = reachable.has(n.id)
              return (
                <button
                  key={n.id}
                  data-testid={`node-${n.id}`}
                  disabled={!isReachable}
                  onClick={() => onChoose(n.id)}
                  className={[
                    'rounded-lg px-4 py-3 border text-center transition',
                    isCurrent ? 'border-amber-400 bg-amber-400/10' : 'border-white/15',
                    n.resolved ? 'opacity-50' : '',
                    isReachable ? 'hover:border-amber-300 cursor-pointer' : 'opacity-40 cursor-not-allowed',
                  ].join(' ')}
                >
                  <div className="text-2xl">{ICON[n.type]}</div>
                  <div className="text-xs mt-1">{LABEL[n.type]}</div>
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run both MapScreen tests** → `npx vitest run tests/screens/MapScreen.test.tsx tests/screens/MapScreen.area.test.tsx` both PASS

- [ ] **Step 5: tsc + full suite** → green
- [ ] **Step 6: Commit**

```bash
git add components/screens/MapScreen.tsx tests/screens/MapScreen.area.test.tsx
git commit -m "feat(run-ui): MapScreen per-area atlas (area ids + area label + resolved)"
```

---

## Task 5: RecruitScreen

**Files:**
- Create: `components/screens/RecruitScreen.tsx`
- Test: `tests/screens/RecruitScreen.test.tsx`

**Interfaces:**
- Consumes: `WizardCard`, `WizardCardRow`, `Button`, `SquadPanel`, `powerOf` (`@/game/engine/combat/teamGen`); `DraftedWizard`.
- Produces: `RecruitScreen(props: { offer: DraftedWizard[]; team: DraftedWizard[]; teamMax: number; onPick: (wizardId: string, replaceId?: string) => void }): JSX.Element` — choose 1 of 3; if team is full, the player also picks which member to replace (default: lowest `powerOf`).

- [ ] **Step 1: Write the failing test**

Create `tests/screens/RecruitScreen.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RecruitScreen } from '@/components/screens/RecruitScreen'
import { offerRecruits, recruitVia } from '@/game/engine/recruit'
import { createRng } from '@/game/engine/rng'

const team = offerRecruits(createRng(1), { house: 'Tassorosso', exclude: new Set() }).slice(0, 2).map(d => recruitVia(d, 'iniziale'))
const offer = offerRecruits(createRng(2), { house: 'Tassorosso', exclude: new Set(team.map(t => t.wizard.id)) })

describe('RecruitScreen', () => {
  it('adds the picked recruit when the team has room', async () => {
    const onPick = vi.fn()
    render(<RecruitScreen offer={offer} team={team} teamMax={5} onPick={onPick} />)
    await userEvent.click(screen.getByTestId(`recruit-${offer[0]!.wizard.id}`))
    await userEvent.click(screen.getByRole('button', { name: /Recluta/ }))
    expect(onPick).toHaveBeenCalledWith(offer[0]!.wizard.id, undefined)
  })
})
```

- [ ] **Step 2: Run test to verify it fails** → FAIL (module not found)

- [ ] **Step 3: Implement `components/screens/RecruitScreen.tsx`**

```tsx
'use client'
import { useState } from 'react'
import type { DraftedWizard } from '@/types'
import { WizardCard } from '@/components/cards/WizardCard'
import { WizardCardRow } from '@/components/cards/WizardCardRow'
import { Button } from '@/components/ui/Button'
import { powerOf } from '@/game/engine/combat/teamGen'

export function RecruitScreen({
  offer, team, teamMax, onPick,
}: {
  offer: DraftedWizard[]
  team: DraftedWizard[]
  teamMax: number
  onPick: (wizardId: string, replaceId?: string) => void
}) {
  const full = team.length >= teamMax
  const weakestId = full ? [...team].sort((a, b) => powerOf(a) - powerOf(b))[0]!.wizard.id : undefined
  const [pick, setPick] = useState<string | null>(null)
  const [replaceId, setReplaceId] = useState<string | undefined>(weakestId)

  return (
    <main className="flex-1 flex flex-col items-center gap-6 p-6">
      <h1 className="font-display text-3xl">Reclutamento</h1>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-4xl">
        {offer.map(d => (
          <div key={d.wizard.id} data-testid={`recruit-${d.wizard.id}`}>
            <WizardCard drafted={d} selected={pick === d.wizard.id} onClick={() => setPick(d.wizard.id)} />
          </div>
        ))}
      </div>
      {full && (
        <div className="w-full max-w-3xl">
          <h2 className="text-sm text-white/60 mb-2">Squadra piena — scegli chi sostituire</h2>
          <div className="flex flex-col gap-2">
            {team.map(t => (
              <button key={t.wizard.id} onClick={() => setReplaceId(t.wizard.id)} data-testid={`replace-${t.wizard.id}`}
                className={`text-left ${replaceId === t.wizard.id ? 'ring-1 ring-amber-400 rounded-lg' : ''}`}>
                <WizardCardRow drafted={t} />
              </button>
            ))}
          </div>
        </div>
      )}
      <Button variant="primary" disabled={!pick} onClick={() => pick && onPick(pick, full ? replaceId : undefined)}>
        Recluta
      </Button>
    </main>
  )
}
```

- [ ] **Step 4: Run test to verify it passes** → PASS (1 test)
- [ ] **Step 5: tsc + full suite** → green
- [ ] **Step 6: Commit**

```bash
git add components/screens/RecruitScreen.tsx tests/screens/RecruitScreen.test.tsx
git commit -m "feat(run-ui): RecruitScreen (choose 1 of 3, replace when full)"
```

---

## Task 6: RelicNodeScreen

**Files:**
- Create: `components/screens/RelicNodeScreen.tsx`
- Test: `tests/screens/RelicNodeScreen.test.tsx`

**Interfaces:**
- Consumes: `RelicCard`, `Button`; `Relic`, `ActiveRelic`.
- Produces: `RelicNodeScreen(props: { offer: Relic[]; owned: ActiveRelic[]; onPick: (relicId: string) => void }): JSX.Element` — choose 1 of the offered relics.

- [ ] **Step 1: Write the failing test**

Create `tests/screens/RelicNodeScreen.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RelicNodeScreen } from '@/components/screens/RelicNodeScreen'
import { offerRelics } from '@/game/engine/relics'
import { createRng } from '@/game/engine/rng'

describe('RelicNodeScreen', () => {
  it('reports the picked relic', async () => {
    const offer = offerRelics(createRng('r'), [], 0)
    const onPick = vi.fn()
    render(<RelicNodeScreen offer={offer} owned={[]} onPick={onPick} />)
    await userEvent.click(screen.getByTestId(`relic-${offer[0]!.id}`))
    await userEvent.click(screen.getByRole('button', { name: /Prendi/ }))
    expect(onPick).toHaveBeenCalledWith(offer[0]!.id)
  })
})
```

- [ ] **Step 2: Run test to verify it fails** → FAIL (module not found)

- [ ] **Step 3: Implement `components/screens/RelicNodeScreen.tsx`**

```tsx
'use client'
import { useState } from 'react'
import type { ActiveRelic, Relic } from '@/types'
import { RelicCard } from '@/components/relics/RelicCard'
import { Button } from '@/components/ui/Button'

export function RelicNodeScreen({
  offer, owned, onPick,
}: {
  offer: Relic[]
  owned: ActiveRelic[]
  onPick: (relicId: string) => void
}) {
  const [pick, setPick] = useState<string | null>(null)
  return (
    <main className="flex-1 flex flex-col items-center gap-6 p-6">
      <h1 className="font-display text-3xl">Scegli una reliquia</h1>
      {owned.length > 0 && <p className="text-white/50 text-sm">Reliquie possedute: {owned.length}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-4xl">
        {offer.map(r => (
          <div key={r.id} data-testid={`relic-${r.id}`}>
            <RelicCard relic={r} onClick={() => setPick(r.id)} className={pick === r.id ? 'ring-2 ring-amber-400 rounded-xl' : ''} />
          </div>
        ))}
      </div>
      <Button variant="primary" disabled={!pick} onClick={() => pick && onPick(pick)}>Prendi</Button>
    </main>
  )
}
```

- [ ] **Step 4: Run test to verify it passes** → PASS (1 test)
- [ ] **Step 5: tsc + full suite** → green
- [ ] **Step 6: Commit**

```bash
git add components/screens/RelicNodeScreen.tsx tests/screens/RelicNodeScreen.test.tsx
git commit -m "feat(run-ui): RelicNodeScreen (choose 1 of 3 relics)"
```

---

## Task 7: LevelUpScreen

**Files:**
- Create: `components/screens/LevelUpScreen.tsx`
- Test: `tests/screens/LevelUpScreen.test.tsx`

**Interfaces:**
- Consumes: `statBreakdown` (`@/lib/statBreakdown`), `Button`, `WizardCardRow`, `displayName`; `DraftedWizard`, `GrowthChoice`, `PendingLevelUp`, `ActiveSynergy`, `ActiveRelic`.
- Produces: `LevelUpScreen(props: { pending: PendingLevelUp; wizard: DraftedWizard; team: DraftedWizard[]; synergies: ActiveSynergy[]; relics: ActiveRelic[]; onChoose: (choice: GrowthChoice) => void }): JSX.Element` — 4 buttons (atk/def/spd/hp) → `onChoose({ atLevel: pending.atLevel, kind })`; shows the stat layers (Base → Livello → Sinergia → Totale) via `statBreakdown`.

- [ ] **Step 1: Write the failing test**

Create `tests/screens/LevelUpScreen.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LevelUpScreen } from '@/components/screens/LevelUpScreen'
import { offerRecruits, recruitVia } from '@/game/engine/recruit'
import { createRng } from '@/game/engine/rng'

const team = offerRecruits(createRng(1), { house: 'Grifondoro', exclude: new Set() }).slice(0, 2).map(d => recruitVia(d, 'iniziale'))

describe('LevelUpScreen', () => {
  it('reports the chosen growth at the pending level', async () => {
    const onChoose = vi.fn()
    render(
      <LevelUpScreen
        pending={{ wizardId: team[0]!.wizard.id, atLevel: 3 }}
        wizard={team[0]!} team={team} synergies={[]} relics={[]} onChoose={onChoose}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: /Attacco/ }))
    expect(onChoose).toHaveBeenCalledWith({ atLevel: 3, kind: 'atk' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails** → FAIL (module not found)

- [ ] **Step 3: Implement `components/screens/LevelUpScreen.tsx`**

```tsx
'use client'
import type { ActiveRelic, ActiveSynergy, DraftedWizard, GrowthChoice, PendingLevelUp } from '@/types'
import { statBreakdown } from '@/lib/statBreakdown'
import { WizardCardRow } from '@/components/cards/WizardCardRow'
import { Button } from '@/components/ui/Button'
import { displayName } from '@/lib/displayName'

const OPTIONS: { kind: GrowthChoice['kind']; label: string }[] = [
  { kind: 'atk', label: 'Attacco' }, { kind: 'def', label: 'Difesa' },
  { kind: 'spd', label: 'Velocità' }, { kind: 'hp', label: 'Salute' },
]

export function LevelUpScreen({
  pending, wizard, team, synergies, relics, onChoose,
}: {
  pending: PendingLevelUp
  wizard: DraftedWizard
  team: DraftedWizard[]
  synergies: ActiveSynergy[]
  relics: ActiveRelic[]
  onChoose: (choice: GrowthChoice) => void
}) {
  const layers = statBreakdown(wizard, team, synergies, relics)
  return (
    <main className="flex-1 flex flex-col items-center gap-6 p-6">
      <h1 className="font-display text-3xl">Livello {pending.atLevel}!</h1>
      <p className="text-white/70">{displayName(wizard)} ha raggiunto una soglia. Scegli un potenziamento.</p>
      <WizardCardRow drafted={wizard} />
      <div className="text-xs text-white/50 flex gap-4">
        <span>Base {layers.base.atk}/{layers.base.def}/{layers.base.spd}</span>
        <span>Livello {layers.afterLevel.atk}/{layers.afterLevel.def}/{layers.afterLevel.spd}</span>
        <span>Totale {layers.total.atk}/{layers.total.def}/{layers.total.spd}</span>
      </div>
      <div className="grid grid-cols-2 gap-3 max-w-md w-full">
        {OPTIONS.map(o => (
          <Button key={o.kind} variant="primary" onClick={() => onChoose({ atLevel: pending.atLevel, kind: o.kind })}>
            +{o.label}
          </Button>
        ))}
      </div>
    </main>
  )
}
```

- [ ] **Step 4: Run test to verify it passes** → PASS (1 test)
- [ ] **Step 5: tsc + full suite** → green
- [ ] **Step 6: Commit**

```bash
git add components/screens/LevelUpScreen.tsx tests/screens/LevelUpScreen.test.tsx
git commit -m "feat(run-ui): LevelUpScreen (milestone growth + stat layers)"
```

---

## Task 8: AreaClearedScreen + runSummary

**Files:**
- Create: `lib/runSummary.ts`
- Create: `components/screens/AreaClearedScreen.tsx`
- Test: `tests/lib/runSummary.test.ts`
- Test: `tests/screens/AreaClearedScreen.test.tsx`

**Interfaces:**
- Produces:
  - `lib/runSummary.ts`: `interface RunSummary { areasCleared: number; teamSize: number; avgLevel: number; relics: number }` and `runSummary(state: RunState): RunSummary`.
  - `AreaClearedScreen(props: { area: number; areasTotal: number; summary: RunSummary; onContinue: () => void }): JSX.Element` — "Area X completata", show summary, "Prosegui" calls `onContinue`.

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/runSummary.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { runSummary } from '@/lib/runSummary'
import { offerRecruits, recruitVia } from '@/game/engine/recruit'
import { createRng } from '@/game/engine/rng'
import type { RunState } from '@/types'

describe('runSummary', () => {
  it('summarizes team size, average level and area', () => {
    const team = offerRecruits(createRng(1), { house: 'Corvonero', exclude: new Set() })
      .slice(0, 3).map(d => ({ ...recruitVia(d, 'iniziale'), level: 2 }))
    const s: RunState = { seed: 's', phase: 'area-cleared', team, activeSynergies: [], stage: 0,
      relics: [], area: 1, teamMax: 5 }
    const out = runSummary(s)
    expect(out.teamSize).toBe(3)
    expect(out.avgLevel).toBe(2)
    expect(out.areasCleared).toBe(2) // area index 1 cleared → 2 areas done
  })
})
```

Create `tests/screens/AreaClearedScreen.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AreaClearedScreen } from '@/components/screens/AreaClearedScreen'

describe('AreaClearedScreen', () => {
  it('continues to the next area', async () => {
    const onContinue = vi.fn()
    render(<AreaClearedScreen area={0} areasTotal={3} summary={{ areasCleared: 1, teamSize: 3, avgLevel: 2, relics: 1 }} onContinue={onContinue} />)
    expect(screen.getByText(/Area 1 completata/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Prosegui/ }))
    expect(onContinue).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail** → FAIL (modules not found)

- [ ] **Step 3: Implement `lib/runSummary.ts` then `components/screens/AreaClearedScreen.tsx`**

```ts
// lib/runSummary.ts
import type { RunState } from '@/types'

export interface RunSummary { areasCleared: number; teamSize: number; avgLevel: number; relics: number }

export function runSummary(state: RunState): RunSummary {
  const team = state.team
  const avg = team.length ? team.reduce((a, d) => a + (d.level ?? 1), 0) / team.length : 0
  return {
    areasCleared: (state.area ?? 0) + 1,
    teamSize: team.length,
    avgLevel: Math.round(avg * 10) / 10,
    relics: state.relics.length,
  }
}
```

```tsx
// components/screens/AreaClearedScreen.tsx
'use client'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import type { RunSummary } from '@/lib/runSummary'

export function AreaClearedScreen({
  area, areasTotal, summary, onContinue,
}: {
  area: number
  areasTotal: number
  summary: RunSummary
  onContinue: () => void
}) {
  return (
    <main className="flex-1 flex flex-col items-center justify-center gap-6 p-8 text-center">
      <motion.h1 initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
        className="font-display text-4xl text-gold">
        Area {area + 1} completata
      </motion.h1>
      <p className="text-white/70">Prossima area: {Math.min(area + 2, areasTotal)} / {areasTotal}</p>
      <div className="glass rounded-xl p-5 flex gap-6 text-sm">
        <span>Squadra: {summary.teamSize}</span>
        <span>Livello medio: {summary.avgLevel}</span>
        <span>Reliquie: {summary.relics}</span>
      </div>
      <Button variant="primary" onClick={onContinue}>Prosegui</Button>
    </main>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass** → both PASS
- [ ] **Step 5: tsc + full suite** → green
- [ ] **Step 6: Commit**

```bash
git add lib/runSummary.ts components/screens/AreaClearedScreen.tsx tests/lib/runSummary.test.ts tests/screens/AreaClearedScreen.test.tsx
git commit -m "feat(run-ui): AreaClearedScreen + runSummary helper"
```

---

## Task 9: RunBRunner orchestrator (wires every phase)

**Files:**
- Create: `components/screens/RunBRunner.tsx`
- Test: `tests/screens/RunBRunner.test.tsx`

**Interfaces:**
- Consumes: `useRunB` + ALL screens above + existing `BattleScreen`, `VictoryScreen`, `ResultScreen`; `recruitOffer`/`relicOffer`, `detectSynergies`, `runSummary`, `displayName`, `BOSSES`.
- Produces: `RunBRunner(props: { seed: string; onExit?: () => void }): JSX.Element` — renders one screen per `controller.view`, with `AnimatePresence` crossfade keyed by `view + currentNodeId`.

**Wiring per view:**
- `house` → `HouseSelectScreen onSelect={c.selectHouse}`
- `starter` → `StarterPickScreen house={c.house!} offer={c.starterOffer} onConfirm={c.confirmStarters} onBack={c.backToHouse}`
- `map` → `MapScreen map currentNodeId reachableIds={c.reachable.map(n=>n.id)} area={c.area} areasTotal={c.areasTotal} onChoose={c.chooseNode}`
- `battle` → `BattleScreen` from `c.battle` (title: boss → `Boss: ${BOSS_NAME}`, else `Battaglia`; `onFinish={c.commitBattle}`)
- `victory` → `VictoryScreen result={c.battle!.result} mvpName fallenNames={c.lastFallen} onNext={c.acknowledgeVictory}` (battleNumber/enemyCount derived from `parseAreaNodeId`)
- `levelup` → `LevelUpScreen pending={c.pendingLevelUp!} wizard={the pending wizard} team synergies={c.run.activeSynergies} relics={c.run.relics} onChoose={c.applyGrowth}`
- `recruit` → `RecruitScreen offer={recruitOffer(c.run, c.currentNode!, createRng(c.run.seed))} team={c.run.team} teamMax={c.run.teamMax!} onPick={c.chooseRecruit}`
- `relic` → `RelicNodeScreen offer={relicOffer(c.run, c.currentNode!, createRng(c.run.seed))} owned={c.run.relics} onPick={c.chooseRelic}`
- `area-cleared` → `AreaClearedScreen area={c.area} areasTotal={c.areasTotal} summary={runSummary(c.run)} onContinue={c.advanceArea}`
- `win` → `ResultScreen outcome="win" seed stageReached={c.area+1} enemyCount={c.areasTotal} onRestart={c.restart}`
- `defeat` → `ResultScreen outcome="defeat" ... onRestart={c.restart}`

> NOTE on recruit/relic offer rng: the offer functions fork internally per `(seed, node id)` so `createRng(seed)` reproduces the same trio the engine commits with. Keep the SAME `createRng(c.run.seed)` the hook uses in `chooseRecruit`/`chooseRelic`.

- [ ] **Step 1: Write the failing test**

Create `tests/screens/RunBRunner.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RunBRunner } from '@/components/screens/RunBRunner'
import { clearRun } from '@/lib/runStore'

beforeEach(() => { try { clearRun() } catch {} ; localStorage.clear() })

describe('RunBRunner', () => {
  it('drives house → starter → map', async () => {
    render(<RunBRunner seed="seed-runner" />)
    expect(screen.getByText(/Scegli la tua Casa/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Grifondoro/ }))
    expect(screen.getByText(/Scegli 2 maghi/)).toBeInTheDocument()
    // pick first two offered cards
    const picks = screen.getAllByTestId(/^pick-/)
    await userEvent.click(picks[0]!)
    await userEvent.click(picks[1]!)
    await userEvent.click(screen.getByRole('button', { name: /Inizia/ }))
    expect(screen.getByText(/Scegli il tuo cammino/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails** → FAIL (module not found)

- [ ] **Step 3: Implement `components/screens/RunBRunner.tsx`** (full switch with the wiring above; use `AnimatePresence mode="wait"` keyed by `${c.view}-${c.run.currentNodeId ?? c.area}`). Derive `battleNumber`/`enemyCount` for combat screens from `parseAreaNodeId(c.currentNode!.id).floor` and `BALANCE.map.floorsPerArea - 1`. Resolve the level-up wizard via `c.run.team.find(t => t.wizard.id === c.pendingLevelUp!.wizardId)!`. Build `nameById` for MVP display from `c.run.team` + `c.battle?.enemy`.

- [ ] **Step 4: Run test to verify it passes** → PASS (1 test)
- [ ] **Step 5: tsc + full suite** → green
- [ ] **Step 6: Commit**

```bash
git add components/screens/RunBRunner.tsx tests/screens/RunBRunner.test.tsx
git commit -m "feat(run-ui): RunBRunner orchestrator wiring every phase"
```

---

## Task 10: Flip the entry — PlayFlow + Menu "Continua run"

**Files:**
- Modify: `components/screens/PlayFlow.tsx`
- Modify: `components/screens/MenuScreen.tsx`
- Test: `tests/screens/PlayFlow.runB.test.tsx`

**Interfaces:**
- `PlayFlow` renders `<RunBRunner seed={activeSeed} onExit={...} />` instead of the legacy `team===null ? DraftScreen : CampaignRunner` branch.
- `MenuScreen` shows "Continua run" when `loadRun()` returns non-null; clicking routes to `/play` (which resumes via `useRunB`). A "Nuova run" button clears any save first.

- [ ] **Step 1: Write the failing test**

Create `tests/screens/PlayFlow.runB.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PlayFlow } from '@/components/screens/PlayFlow'
import { clearRun } from '@/lib/runStore'

beforeEach(() => { try { clearRun() } catch {} ; localStorage.clear() })

describe('PlayFlow → new loop', () => {
  it('starts the new loop at house selection', () => {
    render(<PlayFlow seed="pf-seed" />)
    expect(screen.getByText(/Scegli la tua Casa/)).toBeInTheDocument()
  })
})
```

> If the current `PlayFlow` signature differs (e.g. takes no `seed` and reads it from a gate), adapt the test to the real prop shape discovered in the file — keep the assertion (renders HouseSelect).

- [ ] **Step 2: Run test to verify it fails** → FAIL (still shows draft/team)

- [ ] **Step 3: Modify `PlayFlow.tsx`** to render `RunBRunner` (drop the `team` state + `DraftScreen`/`CampaignRunner` branch). Keep the seed-gate. **Step 3b: Modify `MenuScreen.tsx`** to add a "Continua run" button shown only when `loadRun()` is non-null (guard with a `useEffect`+`useState` for SSR safety), and make "Gioca"/"Nuova run" call `clearRun()` before navigating.

- [ ] **Step 4: Run test to verify it passes** → PASS
- [ ] **Step 5: tsc + full suite** → green (legacy `CampaignRunner`/`useRun`/`DraftScreen` still compile — they are now unused but not yet deleted)
- [ ] **Step 6: Commit**

```bash
git add components/screens/PlayFlow.tsx components/screens/MenuScreen.tsx tests/screens/PlayFlow.runB.test.tsx
git commit -m "feat(run-ui): flip /play to the new loop + Continua run entry"
```

---

## Task 11: Retire the legacy loop + Plan A carry-over

**Files:**
- Delete: `components/screens/DraftScreen.tsx`, `components/screens/CampaignRunner.tsx`, `hooks/useRun.ts`, `tests/engine/campaignBalance.test.ts`, `tests/hooks/useRun.test.ts` (legacy), and any now-orphaned legacy-only tests (`tests/screens/*` that import `CampaignRunner`).
- Modify: `game/engine/run.ts` — remove `startRun`, `confirmTeam`, `nextBattle`, `advanceToNode`, `runPhaseAfterBattle`, and `generateMap` usage from the legacy path. KEEP helpers still used by the new loop (`applyBattleToRoster`, `nodeById`, `addRelic` if reused, channel constants). Verify each export's references with grep before deleting.
- Modify: `game/engine/map.ts` — fold `generateMap` and `generateArea` onto one shared edge-wiring helper and add a no-orphan (incoming-edge) test (Plan A carry-over).
- Test: `tests/engine/mapWiring.test.ts` (new — no-orphan invariant for `generateArea`).

- [ ] **Step 1: Grep every legacy symbol's references**

Run (Bash): `grep -rnE "from '@/hooks/useRun'|nextBattle|confirmTeam|startRun\b|advanceToNode|CampaignRunner|DraftScreen" components app hooks game tests` and record each hit. Anything outside the files being deleted must be migrated first.

- [ ] **Step 2: Write the no-orphan invariant test (Plan A carry-over)**

Create `tests/engine/mapWiring.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { generateArea } from '@/game/engine/map'
import { createRng } from '@/game/engine/rng'
import { BALANCE } from '@/data/constants'

describe('area map wiring', () => {
  it('every non-entry node has at least one incoming edge (no orphans)', () => {
    for (let area = 0; area < BALANCE.map.areas; area++) {
      const map = generateArea(createRng(`w${area}`).fork(4).fork(area), area, { teamSize: 2, teamMax: 5 })
      const incoming = new Set(map.flatMap(n => n.next))
      const entryId = map.find(n => n.id.includes('f0n'))!.id
      for (const n of map) {
        if (n.id === entryId) continue
        expect(incoming.has(n.id), `orphan: ${n.id}`).toBe(true)
      }
    }
  })
  it('no dead ends before the last floor (every non-boss node has an outgoing edge)', () => {
    const map = generateArea(createRng('w').fork(4).fork(0), 0, { teamSize: 2, teamMax: 5 })
    const bossId = map.find(n => n.type === 'boss')!.id
    for (const n of map) if (n.id !== bossId) expect(n.next.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 3: Run the new test** → `npx vitest run tests/engine/mapWiring.test.ts` PASS (proves the invariant already holds; it documents + locks it)

- [ ] **Step 4: Delete legacy files and prune `run.ts`** per the grep results. After each deletion run `npx tsc --noEmit` and fix any dangling import. Remove `tests/engine/campaignBalance.test.ts` (superseded by `campaignBalanceB.test.ts`) and the legacy `tests/hooks/useRun.test.ts`.

- [ ] **Step 5: Full suite + tsc** → `npx tsc --noEmit` exit 0; `npx vitest run` green (now ONLY the new loop remains)

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(run): retire legacy draft-5/nextBattle loop; unify map wiring + no-orphan test"
```

---

## Definition of Done (Piano C)

- [ ] `npx tsc --noEmit` → exit 0
- [ ] `npx vitest run` → all green
- [ ] The browser flow is playable end-to-end: Menu → (Nuova/Continua) → House → 2 starters → route area 0..2 → fight/recruit/relic/level-up → 3 area bosses → final Voldemort → win/defeat, with autosave surviving a reload.
- [ ] No file under `game/engine/combat/*` modified.
- [ ] Legacy `nextBattle`/`confirmTeam`/old `useRun`/`DraftScreen`/`CampaignRunner` removed; `campaignBalance.test.ts` removed (superseded by `campaignBalanceB.test.ts`).
- [ ] Plan A carry-over closed: shared map edge-wiring + no-orphan/no-dead-end invariant test.

## Cosa NON è in questo piano (→ Fase 2+)

Shop/event/commonRoom/library/potions/forest nodes + galleoni/potions economy; Hogwarts map theming + end-of-run story screen (Fase 4); audio/juice polish. These are additive: a new node row in `NODE_CATALOG` + a `resolvers/<kind>.ts` + a screen + a `RunBRunner` case — no engine changes.
