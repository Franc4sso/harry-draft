import type { ActiveSynergy, BattleResult, DraftedWizard, RunNode, RunState } from '@/types'
import type { Rng } from '../rng'
import { battleReadyTeam } from '../battlePrep'
import { simulateBattle } from '../combat/simulate'
import { generateEnemyTeam, generateBossTeam } from '../combat/teamGen'
import { detectSynergies } from '../synergy'
import { selectEnemyRelics } from '../relics'
import { applyBattleToRoster } from '../run'
import { addExp } from '../leveling'
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
  expEach: number
  milestones: { wizardId: string; level: number }[]
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

/** New-loop menace (stat multiplier as a pct) at a depth, scaled by node kind. */
function menaceB(depth: number, kind: 'normal' | 'elite' | 'boss'): number {
  const cb = BALANCE.campaignB
  const base = cb.menaceBase + cb.menacePerDepth * depth
  if (kind === 'elite') return base * cb.menaceEliteMult
  if (kind === 'boss') return base * cb.menaceBossMult
  return base
}

export function resolveCombat(state: RunState, node: RunNode, rng: Rng): CombatResult {
  const cb = BALANCE.campaignB
  const { area, floor } = parseAreaNodeId(node.id)
  const isBoss = node.type === 'boss'
  const isFinalBoss = isBoss && area >= BALANCE.map.areas - 1
  const depth = globalDepth(area, floor)
  const enemyRng = rng.fork(depth + 1)
  const battleRng = rng.fork(depth + 100)
  const nodeType: 'normal' | 'elite' | 'boss' = isBoss ? 'boss' : (node.type === 'elite' ? 'elite' : 'normal')

  // Only the FINAL area's boss is the scripted Voldemort (always a full team of 5).
  // Earlier area bosses are strong-but-scaled enemy teams on the new-loop budget curve,
  // and every non-final fight is trimmed to the area's enemy count so a growing player
  // is not perpetually outnumbered. `generateEnemyTeam` returns its 5 sorted by power
  // desc, so slicing keeps the strongest `count`.
  const budgetMult = nodeType === 'elite' ? cb.eliteBudgetMult : isBoss ? cb.bossBudgetMult : 1
  const count = cb.enemyCountByArea[area] ?? cb.enemyCountByArea[cb.enemyCountByArea.length - 1]!
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

  const rightMenace = isFinalBoss ? cb.finalBossMenace : menaceB(depth, nodeType)

  // Levels apply HERE, before combat — engine stays pure.
  const ready = battleReadyTeam(state.team)
  const playerSyn = detectSynergies(ready)
  const result = simulateBattle(ready, enemy, battleRng, {
    leftSyn: playerSyn, rightSyn: enemySyn, leftRelics: state.relics,
    rightRelics, rightMenace,
  })

  // Persist HP onto the ORIGINAL (unleveled) roster via the existing helper,
  // then award EXP to survivors.
  const persisted = applyBattleToRoster(state.team, result.finalSnapshot)
  const expEach = isBoss ? BALANCE.leveling.expBoss
    : node.type === 'elite' ? BALANCE.leveling.expElite : BALANCE.leveling.expBattle
  const milestones: { wizardId: string; level: number }[] = []
  const survivors = persisted.map(dw => {
    const { dw: leveled, milestones: ms } = addExp(dw, expEach)
    for (const lv of ms) milestones.push({ wizardId: dw.wizard.id, level: lv })
    return leveled
  })

  return { result, enemy, enemySyn, isBoss, isFinalBoss, survivors, expEach, milestones }
}

export const combatResolver: NodeResolver = {
  id: 'battle', // registered for battle/elite/boss (they share this resolver id via aliases — see index registration)
  enter: () => ({ offers: {}, isCombat: true }),
  resolve: (state, node, _choice, rng) => {
    const out = resolveCombat(state, node, rng)
    const newLog = [...(state.log ?? []), ...out.milestones.map(m => ({
      area: state.area ?? 0, nodeId: node.id, kind: 'levelMilestone' as const,
      summary: `${m.wizardId} raggiunge il livello ${m.level}`,
    }))]
    const pending = [...(state.pendingLevelUps ?? []), ...out.milestones.map(m => ({ wizardId: m.wizardId, atLevel: m.level }))]
    return {
      ...state,
      team: out.survivors,
      activeSynergies: detectSynergies(out.survivors),
      lastBattle: out.result,
      log: newLog,
      pendingLevelUps: pending,
    }
  },
}
