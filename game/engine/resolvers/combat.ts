import type { ActiveSynergy, BattleResult, DraftedWizard, RunNode, RunState } from '@/types'
import type { Rng } from '../rng'
import { battleReadyTeam } from '../battlePrep'
import { simulateBattle } from '../combat/simulate'
import { generateEnemyTeam, generateBossTeam, budgetForStage } from '../combat/teamGen'
import { detectSynergies } from '../synergy'
import { selectEnemyRelics } from '../relics'
import { menacePctFor, applyBattleToRoster } from '../run'
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
  survivors: DraftedWizard[]
  expEach: number
  milestones: { wizardId: string; level: number }[]
}

/** Global progression depth across areas: area * (floors-1) + floor. */
function globalDepth(area: number, floor: number): number {
  return area * (BALANCE.map.floorsPerArea - 1) + floor
}

export function resolveCombat(state: RunState, node: RunNode, rng: Rng): CombatResult {
  const { area, floor } = parseAreaNodeId(node.id)
  const isBoss = node.type === 'boss'
  const depth = globalDepth(area, floor)
  const enemyRng = rng.fork(depth + 1)
  const battleRng = rng.fork(depth + 100)

  const eliteMult = node.type === 'elite' ? BALANCE.map.eliteBudgetMult : 1
  const enemy = isBoss
    ? generateBossTeam(enemyRng, BOSSES[0]!)
    : generateEnemyTeam(enemyRng, Math.round(budgetForStage(depth) * eliteMult))
  const nodeType: 'normal' | 'elite' | 'boss' = isBoss ? 'boss' : (node.type === 'elite' ? 'elite' : 'normal')

  const bossSyn = isBoss ? BOSSES[0]!.exclusiveSynergy : undefined
  const enemySyn = bossSyn
    ? [...detectSynergies(enemy), { synergy: bossSyn, memberIds: enemy.map(d => d.wizard.id) }]
    : detectSynergies(enemy)

  const relicCount = nodeType === 'boss' ? BALANCE.campaign.enemyRelicsBoss
    : nodeType === 'elite' ? BALANCE.campaign.enemyRelicsElite : 0
  const rightRelics = relicCount > 0 ? selectEnemyRelics(rng.fork(depth + 200), relicCount) : []

  // Levels apply HERE, before combat — engine stays pure.
  const ready = battleReadyTeam(state.team)
  const playerSyn = detectSynergies(ready)
  const result = simulateBattle(ready, enemy, battleRng, {
    leftSyn: playerSyn, rightSyn: enemySyn, leftRelics: state.relics,
    rightRelics, rightMenace: menacePctFor(depth, nodeType),
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

  return { result, enemy, enemySyn, isBoss, survivors, expEach, milestones }
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
