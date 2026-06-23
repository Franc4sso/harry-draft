import type { ActiveSynergy, BattleResult, DraftedWizard, Relic, RunNode, RunState, UnitSnapshot } from '@/types'
import { createRng } from './rng'
import { detectSynergies } from './synergy'
import { simulateBattle } from './combat/simulate'
import { generateEnemyTeam, generateBossTeam, budgetForStage } from './combat/teamGen'
import { generateMap, mapRngChannel, nodeDepth } from './map'
import { BALANCE } from '@/data/constants'
import { BOSSES } from '@/data/bosses'

export const draftRngChannel = 1
export const combatRngChannel = 2
export const relicOfferRngChannel = 3

export function startRun(seed: string): RunState {
  return { seed, phase: 'draft', team: [], activeSynergies: [], stage: 0, relics: [] }
}

export function addRelic(state: RunState, relic: Relic): RunState {
  return { ...state, relics: [...state.relics, { relic, stageObtained: state.stage }] }
}

export function confirmTeam(state: RunState, team: DraftedWizard[]): RunState {
  const map = generateMap(createRng(state.seed).fork(mapRngChannel))
  return {
    ...state, team, activeSynergies: detectSynergies(team),
    phase: 'team', map, currentNodeId: map[0]!.id,
  }
}

export function nodeById(state: RunState, id: string): RunNode | undefined {
  return state.map?.find(n => n.id === id)
}

export function advanceToNode(state: RunState, nodeId: string): RunState {
  const cur = state.currentNodeId ? nodeById(state, state.currentNodeId) : undefined
  if (!cur || !cur.next.includes(nodeId)) {
    throw new Error(`illegal move: ${state.currentNodeId} -> ${nodeId}`)
  }
  return { ...state, currentNodeId: nodeId }
}

export interface BattleOutcome {
  state: RunState
  result: BattleResult
  /** The enemy team faced this battle — needed to render/replay the fight. */
  enemy: DraftedWizard[]
  enemySyn: ActiveSynergy[]
  isBoss: boolean
}

export function applyBattleToRoster(
  team: DraftedWizard[], snapshot: UnitSnapshot[],
): DraftedWizard[] {
  const byId = new Map(snapshot.map(s => [s.id, s]))
  return team
    .filter(dw => byId.get(dw.wizard.id)?.alive !== false) // drop the dead; keep if no snapshot entry
    .map(dw => {
      const snap = byId.get(dw.wizard.id)
      if (!snap) return dw
      // Snapshot HP is out of the BUFFED battle maxHp; persist as a fraction of the
      // wizard's BASE maxHp so buff swings between battles don't distort wounds.
      const frac = snap.maxHp > 0 ? snap.hp / snap.maxHp : 0
      return { ...dw, currentHp: Math.round(dw.maxHp * frac) }
    })
}

export function nextBattle(state: RunState): BattleOutcome {
  const cur = state.currentNodeId ? nodeById(state, state.currentNodeId) : undefined
  const isBoss = cur?.type === 'boss'
  const depth = cur ? nodeDepth(cur.id) : state.stage // fallback keeps legacy callers working
  const base = createRng(state.seed).fork(combatRngChannel)
  const enemyRng = base.fork(depth + 1)
  const battleRng = base.fork(depth + 100)

  const eliteMult = cur?.type === 'elite' ? BALANCE.map.eliteBudgetMult : 1
  const enemy = isBoss
    ? generateBossTeam(enemyRng, BOSSES[0]!)
    : generateEnemyTeam(enemyRng, Math.round(budgetForStage(depth) * eliteMult))
  const enemySyn = detectSynergies(enemy)

  const result = simulateBattle(state.team, enemy, battleRng, {
    leftSyn: state.activeSynergies, rightSyn: enemySyn, leftRelics: state.relics,
  })

  const won = result.winner === 'left'
  const nextStage = state.stage + 1
  const phase: RunState['phase'] = !won
    ? 'defeat'
    : isBoss ? 'win' : 'victory'

  return {
    state: { ...state, stage: nextStage, lastBattle: result, phase },
    result, enemy, enemySyn, isBoss,
  }
}
