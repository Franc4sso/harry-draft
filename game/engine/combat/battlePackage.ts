import type { ActiveSynergy, NodeBattle, NodePreview } from '@/types'
import { createRng } from '../rng'
import { themedEnemyTeam, generateBossTeam } from './teamGen'
import { enemyLevelFor, globalDepth, budgetB } from '../resolvers/combat'
import { detectSynergies } from '../synergy'
import { selectEnemyRelics } from '../relics'
import { BALANCE } from '@/data/constants'
import { BOSSES } from '@/data/bosses'

type Kind = 'battle' | 'elite' | 'boss'
const enemyKind = (k: Kind): 'normal' | 'elite' | 'boss' => (k === 'battle' ? 'normal' : k)

/** Build a node's full battle package using the CANONICAL combat fork
 *  (createRng(seed).fork(2).fork(area).fork(floor)) so a pre-generated package is
 *  identical to what the live resolver would have produced. */
export function buildBattlePackage(
  seed: string, area: number, floor: number, kind: Kind, excludeThemes: string[] = [],
): { battle: NodeBattle; preview: NodePreview; themeId: string | null } {
  const cb = BALANCE.campaignB
  const isBoss = kind === 'boss'
  const isFinalBoss = isBoss && area >= BALANCE.map.areas - 1
  const ek = enemyKind(kind)
  const depth = globalDepth(area, floor)
  const enemyLevel = enemyLevelFor(area, ek, isFinalBoss)

  // Canonical combat fork (channel 2), then the same enemy/relics sub-forks the
  // resolver used (depth+1 enemy, depth+200 relics).
  const combatFork = createRng(seed).fork(2).fork(area).fork(floor)
  const enemyRng = combatFork.fork(depth + 1)

  const budgetMult = ek === 'elite' ? cb.eliteBudgetMult : isBoss ? cb.bossBudgetMult : 1
  const count = ek === 'normal'
    ? cb.normalEnemyCount
    : (cb.enemyCountByArea[area] ?? cb.enemyCountByArea[cb.enemyCountByArea.length - 1]!)

  let enemyTeam, themeId: string | null = null, bossSynergy: ActiveSynergy | undefined
  if (isFinalBoss) {
    enemyTeam = generateBossTeam(enemyRng, BOSSES[0]!)
    bossSynergy = BOSSES[0]!.exclusiveSynergy
      ? { synergy: BOSSES[0]!.exclusiveSynergy, memberIds: enemyTeam.map(d => d.wizard.id) }
      : undefined
  } else {
    const out = themedEnemyTeam(enemyRng, {
      area, kind: ek, budget: Math.round(budgetB(depth) * budgetMult), count, excludeThemes,
    })
    enemyTeam = out.team
    themeId = out.themeId
  }

  const relicCount = ek === 'boss' ? cb.enemyRelicsBoss : ek === 'elite' ? cb.enemyRelicsElite : 0
  const enemyRelics = relicCount > 0 ? selectEnemyRelics(combatFork.fork(depth + 200), relicCount) : []

  const detected = detectSynergies(enemyTeam)
  const synergyIds = bossSynergy
    ? [...detected.map(s => s.synergy.id), bossSynergy.synergy.id]
    : detected.map(s => s.synergy.id)

  const battle: NodeBattle = { enemyTeam, enemyRelics, enemyLevel, bossSynergy }
  const preview: NodePreview = {
    synergyIds,
    bossName: isFinalBoss ? BOSSES[0]!.name : undefined,
  }
  return { battle, preview, themeId }
}
