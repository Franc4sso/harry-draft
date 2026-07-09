import type { ActiveRelic, ActiveSynergy, BattleResult, DraftedWizard, RunNode, RunState } from '@/types'
import type { Rng } from '../rng'
import { battleReadyTeam } from '../battlePrep'
import { simulateBattle } from '../combat/simulate'
import { buildBattlePackage } from '../combat/battlePackage'
import { detectSynergies } from '../synergy'
import { applyRelicScaling } from '../relics'
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
  /** Right-side menace/relics/damageReduction/ignoresTaunt actually fed to simulateBattle —
   *  exposed so buildReplay can mirror them and the InitiativeBar's displayed spd matches
   *  the order the sim actually used (see replay.ts buildReplay opts). */
  rightMenace: number
  rightRelics: ActiveRelic[]
  rightDamageReduction: number
  rightIgnoresTaunt: boolean
}

export function resolveCombat(state: RunState, node: RunNode, rng: Rng): CombatResult {
  const { area, floor } = parseAreaNodeId(node.id)
  const isBoss = node.type === 'boss'
  const isFinalBoss = isBoss && area >= BALANCE.map.areas - 1
  const depth = globalDepth(area, floor)
  const battleRng = rng.fork(depth + 100)
  const nodeType: EnemyKind = isBoss ? 'boss' : (node.type === 'elite' ? 'elite' : 'normal')
  // Displayed level is still the explicit area+kind threat tier (identical to the value
  // the package stored).
  const enemyLevel = enemyLevelFor(area, nodeType, isFinalBoss)

  // Single source of truth: read the pre-generated package from the node. Legacy
  // saves (no node.battle) reconstruct it from the SAME builder — no divergence. The
  // combat path adds ZERO new rng draws: the team/relics are pre-built.
  const pkg = node.battle ?? buildBattlePackage(state.seed, area, floor, node.type as 'battle' | 'elite' | 'boss', [], state.endless ?? false).battle
  // Enemies now carry a real level (stamped in buildBattlePackage) and go through the
  // SAME leveling path as the player, so a level-N enemy shows level-N stats instead
  // of flat level-1 stats propped up entirely by menace.
  // Safety net for saves whose MAP was generated before per-unit levels were stamped
  // (pre-f67fe4e): such units carry no `level`, which would silently fall back to
  // level-1 stats in leveledStats. Backfill from the package's own enemyLevel — the
  // same value map-gen would have stamped — so old saves see the correct enemy level
  // too. No-op for fresh packages, which already carry `level` on every unit.
  const enemyTeam = pkg.enemyTeam.some(dw => dw.level === undefined)
    ? pkg.enemyTeam.map(dw => (dw.level === undefined ? { ...dw, level: pkg.enemyLevel ?? enemyLevel } : dw))
    : pkg.enemyTeam
  const enemy = battleReadyTeam(enemyTeam)
  const rightRelics = pkg.enemyRelics
  const bossSyn = pkg.bossSynergy?.synergy
  const rightDamageReduction = pkg.unitDamageReduction ?? 0
  const rightIgnoresTaunt = pkg.ignoresTaunt ?? false

  const enemySyn = bossSyn
    ? [...detectSynergies(enemy), { synergy: bossSyn, memberIds: enemy.map(d => d.wizard.id) }]
    : detectSynergies(enemy)

  // Menace removed (2026-07-01): enemy difficulty comes only from level (grown stats,
  // stamped in buildBattlePackage) + draft budget. menaceForLevel always returns 0;
  // the rightMenace plumbing is kept as a no-op so toBattleUnits/replay.ts don't need
  // reshaping (their menace param is a generic, independently-tested primitive — see
  // tests/engine/menace.test.ts).
  const rightMenace = menaceForLevel(pkg.enemyLevel)

  // Levels apply HERE, before combat — engine stays pure.
  const ready = battleReadyTeam(livingOf(state.team))
  const playerSyn = detectSynergies(ready)
  const result = simulateBattle(ready, enemy, battleRng, {
    leftSyn: playerSyn, rightSyn: enemySyn, leftRelics: state.relics,
    rightRelics, rightMenace, rightDamageReduction, rightIgnoresTaunt,
  })

  // Persist HP onto the ORIGINAL (unleveled) roster via the existing helper, then grant
  // whole levels to the survivors for the clear (normal +1, elite +2, boss +3).
  const persisted = applyBattleToRoster(state.team, result.finalSnapshot)
  const levelsGained = isBoss ? BALANCE.leveling.levelsPerBoss
    : nodeType === 'elite' ? BALANCE.leveling.levelsPerElite : BALANCE.leveling.levelsPerBattle
  const survivors = persisted.map(dw => isDead(dw) ? dw : gainLevels(dw, levelsGained).dw)

  return {
    result, enemy, enemySyn, isBoss, isFinalBoss, survivors, levelsGained, enemyLevel,
    rightMenace, rightRelics, rightDamageReduction, rightIgnoresTaunt,
  }
}

export const combatResolver: NodeResolver = {
  id: 'battle', // registered for battle/elite/boss (they share this resolver id via aliases — see index registration)
  enter: () => ({ offers: {}, isCombat: true }),
  resolve: (state, node, _choice, rng) => {
    const out = resolveCombat(state, node, rng)
    return {
      ...state,
      team: out.survivors,
      relics: applyRelicScaling(state.relics, {
        kill: out.result.kills.left,
        battleWin: out.result.winner === 'left' ? 1 : 0,
        turn: out.result.turns,
        allyDead: out.result.alliesLost,
      }),
      activeSynergies: detectSynergies(livingOf(out.survivors)),
      lastBattle: out.result,
    }
  },
}
