import type { ActiveSynergy, BattleResult, DraftedWizard, RunNode, RunState } from '@/types'
import type { Rng } from '../rng'
import { battleReadyTeam } from '../battlePrep'
import { simulateBattle } from '../combat/simulate'
import { generateEnemyTeam, generateBossTeam } from '../combat/teamGen'
import { detectSynergies } from '../synergy'
import { selectEnemyRelics } from '../relics'
import { applyBattleToRoster } from '../run'
import { gainLevels } from '../leveling'
import { isDead, livingOf } from '../roster'
import { parseAreaNodeId } from '../map'
import { BALANCE } from '@/data/constants'
import { BOSSES } from '@/data/bosses'
import type { NodeResolver } from './types'

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

export type EnemyKind = 'normal' | 'elite' | 'boss'

/** Displayed enemy level as an explicit, area-scaled threat tier (NOT derived from
 *  menace). normal → 1,3,5 · elite → 3,5,7 · area-boss → 4,6,8 · final boss → levelMax.
 *  Clamped to [1, levelMax]. Enemy menace is derived FROM this (see menaceForLevel),
 *  so the level the player sees genuinely tracks difficulty. */
export function enemyLevelFor(area: number, kind: EnemyKind, isFinalBoss: boolean): number {
  const cb = BALANCE.campaignB
  const max = BALANCE.leveling.levelMax
  const lvl = isFinalBoss
    ? max
    : kind === 'boss' ? cb.bossLevelBase + cb.bossLevelPerArea * area
    : kind === 'elite' ? cb.eliteLevelBase + cb.eliteLevelPerArea * area
    : cb.normalLevelBase + cb.normalLevelPerArea * area
  return Math.max(1, Math.min(max, lvl))
}

/** Enemy stat menace (1+pct) derived from the displayed level: a higher-level foe is
 *  a genuinely stronger one. menaceOffset is negative to keep area-0 (level-1) fights
 *  winnable for a starting level-1 duo. */
export function menaceForLevel(level: number): number {
  const cb = BALANCE.campaignB
  return (level - 1) * cb.menacePerLevel + cb.menaceOffset
}

/** Monotonic progression depth across areas: areas are spaced by floorsPerArea so
 *  the last node of one area and the first of the next never collide. */
export function globalDepth(area: number, floor: number): number {
  return area * BALANCE.map.floorsPerArea + floor
}

/** New-loop enemy budget at a global depth (decoupled from the legacy `campaign`). */
function budgetB(depth: number): number {
  return BALANCE.campaignB.baseBudget + depth * BALANCE.campaignB.budgetStep
}

export function resolveCombat(state: RunState, node: RunNode, rng: Rng): CombatResult {
  const cb = BALANCE.campaignB
  const { area, floor } = parseAreaNodeId(node.id)
  const isBoss = node.type === 'boss'
  const isFinalBoss = isBoss && area >= BALANCE.map.areas - 1
  const depth = globalDepth(area, floor)
  const enemyRng = rng.fork(depth + 1)
  const battleRng = rng.fork(depth + 100)
  const nodeType: EnemyKind = isBoss ? 'boss' : (node.type === 'elite' ? 'elite' : 'normal')
  const enemyLevel = enemyLevelFor(area, nodeType, isFinalBoss)

  // Only the FINAL area's boss is the scripted Voldemort (always a full team of 5).
  // Earlier area bosses are strong-but-scaled enemy teams on the new-loop budget curve.
  // Normal fights are trimmed to a small skirmish (`normalEnemyCount`) so a growing
  // player is not swarmed; elite/area-boss field the area's full count, making them the
  // bigger threat. `generateEnemyTeam` returns its 5 sorted by power desc, so slicing
  // keeps the strongest `count`.
  const budgetMult = nodeType === 'elite' ? cb.eliteBudgetMult : isBoss ? cb.bossBudgetMult : 1
  const count = nodeType === 'normal'
    ? cb.normalEnemyCount
    : (cb.enemyCountByArea[area] ?? cb.enemyCountByArea[cb.enemyCountByArea.length - 1]!)
  const enemy = isFinalBoss
    ? generateBossTeam(enemyRng, BOSSES[0]!)
    : generateEnemyTeam(enemyRng, Math.round(budgetB(depth) * budgetMult)).slice(0, count)

  const bossSyn = isFinalBoss ? BOSSES[0]!.exclusiveSynergy : undefined
  const enemySyn = bossSyn
    ? [...detectSynergies(enemy), { synergy: bossSyn, memberIds: enemy.map(d => d.wizard.id) }]
    : detectSynergies(enemy)

  const relicCount = nodeType === 'boss' ? cb.enemyRelicsBoss
    : nodeType === 'elite' ? cb.enemyRelicsElite : 0
  const rightRelics = relicCount > 0 ? selectEnemyRelics(rng.fork(depth + 200), relicCount) : []

  const rightMenace = isFinalBoss ? cb.finalBossMenace : menaceForLevel(enemyLevel)

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
