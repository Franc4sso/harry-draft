import type { ActiveSynergy, BattleResult, DraftedWizard, Relic, RunNode, RunState, Side, UnitSnapshot } from '@/types'
import { createRng } from './rng'
import { detectSynergies } from './synergy'
import { selectEnemyRelics } from './relics'
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
  // Only the LEFT side is the player team. A player wizard must NEVER read an
  // enemy's snapshot entry: enemies draft from the same top-power roster, so a
  // player and enemy can share a base id. Keying by id alone let the right-side
  // (spread after left) entry overwrite the player's — surviving players got
  // dropped, dead players wrongly kept, HP sourced from the wrong unit (C1).
  const byId = new Map(snapshot.filter(s => s.side === 'left').map(s => [s.id, s]))
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

/**
 * Pure derivation of the run phase after a fight resolves.
 * - Roster wiped → defeat (regardless of node type).
 * - Boss node → win-or-bust: win iff the player (left) won, else defeat.
 * - Non-boss node → any survivor means the player advances → victory.
 */
export function runPhaseAfterBattle(
  wiped: boolean, isBoss: boolean, winner: Side,
): RunState['phase'] {
  if (wiped) return 'defeat'
  if (isBoss) return winner === 'left' ? 'win' : 'defeat'
  return 'victory'
}

/**
 * Per-stage enemy stat multiplier percentage. Gentle early (menaceBase), steep
 * late (menacePerStage * depth), amplified on elite/boss nodes. Calibrated in
 * the campaign balance test.
 */
export function menacePctFor(depth: number, nodeType: 'normal' | 'elite' | 'boss'): number {
  const c = BALANCE.campaign
  const base = c.menaceBase + c.menacePerStage * depth
  if (nodeType === 'elite') return base * c.menaceEliteMult
  if (nodeType === 'boss') return base * c.menaceBossMult
  return base
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
  const nodeType: 'normal' | 'elite' | 'boss' = isBoss ? 'boss' : (cur?.type === 'elite' ? 'elite' : 'normal')

  // Boss carries its exclusive synergy (previously defined but never applied).
  // ActiveSynergy is { synergy, memberIds }; applyBonuses sums synergy.bonus
  // regardless of memberIds, so listing the whole roster applies it team-wide.
  const bossSyn = isBoss ? BOSSES[0]!.exclusiveSynergy : undefined
  const enemySyn = bossSyn
    ? [...detectSynergies(enemy), { synergy: bossSyn, memberIds: enemy.map(d => d.wizard.id) }]
    : detectSynergies(enemy)

  // Real relics for elite/boss enemies (forked rng channel so it never disturbs
  // the enemy-draft or battle streams).
  const relicCount = nodeType === 'boss' ? BALANCE.campaign.enemyRelicsBoss
    : nodeType === 'elite' ? BALANCE.campaign.enemyRelicsElite : 0
  const rightRelics = relicCount > 0
    ? selectEnemyRelics(base.fork(depth + 200), relicCount)
    : []

  const result = simulateBattle(state.team, enemy, battleRng, {
    leftSyn: state.activeSynergies, rightSyn: enemySyn, leftRelics: state.relics,
    rightRelics, rightMenace: menacePctFor(depth, nodeType),
  })

  const newTeam = applyBattleToRoster(state.team, result.finalSnapshot)
  const newSyn = detectSynergies(newTeam)
  const wiped = newTeam.length === 0
  const phase = runPhaseAfterBattle(wiped, isBoss, result.winner)

  return {
    state: { ...state, team: newTeam, activeSynergies: newSyn, stage: state.stage + 1, lastBattle: result, phase },
    result, enemy, enemySyn, isBoss,
  }
}
