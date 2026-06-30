import type { ActiveSynergy, BattleResult, DraftedWizard, RunNode, RunState } from '@/types'
import type { Rng } from '../rng'
import { battleReadyTeam } from '../battlePrep'
import { simulateBattle } from '../combat/simulate'
import { buildBattlePackage } from '../combat/battlePackage'
import { detectSynergies } from '../synergy'
import { applyBattleToRoster } from '../run'
import { gainLevels } from '../leveling'
import { isDead, livingOf } from '../roster'
import { parseAreaNodeId } from '../map'
import { BALANCE } from '@/data/constants'
import { enemyLevelFor, menaceForLevel, globalDepth } from '../combat/threat'
import type { EnemyKind } from '../combat/threat'
import type { NodeResolver } from './types'

// Re-export the pure threat helpers (moved to combat/threat.ts to break the
// resolver↔battlePackage import cycle) so existing external importers still resolve.
export { enemyLevelFor, menaceForLevel, globalDepth, budgetB } from '../combat/threat'
export type { EnemyKind } from '../combat/threat'

export interface CombatResult {
  result: BattleResult
  enemy: DraftedWizard[]
  enemySyn: ActiveSynergy[]
  isBoss: boolean
  isFinalBoss: boolean
  survivors: DraftedWizard[]
  /** Whole levels granted to each survivor for clearing this fight (1/2/3). */
  levelsGained: number
  /** Enemy level shown in the UI — an explicit area+kind threat tier. */
  enemyLevel: number
}

export function resolveCombat(state: RunState, node: RunNode, rng: Rng): CombatResult {
  const cb = BALANCE.campaignB
  const { area, floor } = parseAreaNodeId(node.id)
  const isBoss = node.type === 'boss'
  const isFinalBoss = isBoss && area >= BALANCE.map.areas - 1
  const depth = globalDepth(area, floor)
  const battleRng = rng.fork(depth + 100)
  const nodeType: EnemyKind = isBoss ? 'boss' : (node.type === 'elite' ? 'elite' : 'normal')
  // Displayed level is still the explicit area+kind threat tier (identical to the value
  // the package stored — see menace below).
  const enemyLevel = enemyLevelFor(area, nodeType, isFinalBoss)

  // Single source of truth: read the pre-generated package from the node. Legacy
  // saves (no node.battle) reconstruct it from the SAME builder — no divergence. The
  // combat path adds ZERO new rng draws: the team/relics are pre-built.
  const pkg = node.battle ?? buildBattlePackage(state.seed, area, floor, node.type as 'battle' | 'elite' | 'boss').battle
  const enemy = pkg.enemyTeam
  const rightRelics = pkg.enemyRelics
  const bossSyn = pkg.bossSynergy?.synergy

  const enemySyn = bossSyn
    ? [...detectSynergies(enemy), { synergy: bossSyn, memberIds: enemy.map(d => d.wizard.id) }]
    : detectSynergies(enemy)

  const rightMenace = isFinalBoss ? cb.finalBossMenace : menaceForLevel(pkg.enemyLevel)

  // Levels apply HERE, before combat — engine stays pure.
  const ready = battleReadyTeam(livingOf(state.team))
  const playerSyn = detectSynergies(ready)
  const result = simulateBattle(ready, enemy, battleRng, {
    leftSyn: playerSyn, rightSyn: enemySyn, leftRelics: state.relics,
    rightRelics, rightMenace,
  })

  // Persist HP onto the ORIGINAL (unleveled) roster via the existing helper, then grant
  // whole levels to the survivors for the clear (normal +1, elite +2, boss +3).
  const persisted = applyBattleToRoster(state.team, result.finalSnapshot)
  const levelsGained = isBoss ? BALANCE.leveling.levelsPerBoss
    : nodeType === 'elite' ? BALANCE.leveling.levelsPerElite : BALANCE.leveling.levelsPerBattle
  const survivors = persisted.map(dw => isDead(dw) ? dw : gainLevels(dw, levelsGained).dw)

  return { result, enemy, enemySyn, isBoss, isFinalBoss, survivors, levelsGained, enemyLevel }
}

export const combatResolver: NodeResolver = {
  id: 'battle', // registered for battle/elite/boss (they share this resolver id via aliases — see index registration)
  enter: () => ({ offers: {}, isCombat: true }),
  resolve: (state, node, _choice, rng) => {
    const out = resolveCombat(state, node, rng)
    return {
      ...state,
      team: out.survivors,
      activeSynergies: detectSynergies(livingOf(out.survivors)),
      lastBattle: out.result,
    }
  },
}
