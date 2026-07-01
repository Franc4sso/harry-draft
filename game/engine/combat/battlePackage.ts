import type { ActiveSynergy, DraftedWizard, NodeBattle, NodePreview } from '@/types'
import { createRng } from '../rng'
import { themedEnemyTeam, generateBossTeam } from './teamGen'
import { enemyLevelFor, globalDepth, budgetB } from './threat'
import { detectSynergies } from '../synergy'
import { selectEnemyRelics } from '../relics'
import { BALANCE } from '@/data/constants'
import { BOSSES, MURO, BELLATRIX } from '@/data/bosses'

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
  const isFirstBoss = isBoss && area === MURO.pinnedArea
  const isBellatrixBoss = isBoss && !isFinalBoss && area === BELLATRIX.pinnedArea
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
  let unitDamageReduction: number | undefined
  let ignoresTaunt: boolean | undefined
  if (isFinalBoss) {
    enemyTeam = generateBossTeam(enemyRng, BOSSES[0]!)
    bossSynergy = BOSSES[0]!.exclusiveSynergy
      ? { synergy: BOSSES[0]!.exclusiveSynergy, memberIds: enemyTeam.map(d => d.wizard.id) }
      : undefined
  } else if (isFirstBoss) {
    enemyTeam = generateBossTeam(enemyRng, MURO)
    bossSynergy = MURO.exclusiveSynergy
      ? { synergy: MURO.exclusiveSynergy, memberIds: enemyTeam.map(d => d.wizard.id) }
      : undefined
    unitDamageReduction = MURO.unitDamageReduction
  } else if (isBellatrixBoss) {
    enemyTeam = generateBossTeam(enemyRng, BELLATRIX)
    bossSynergy = BELLATRIX.exclusiveSynergy
      ? { synergy: BELLATRIX.exclusiveSynergy, memberIds: enemyTeam.map(d => d.wizard.id) }
      : undefined
    ignoresTaunt = BELLATRIX.ignoresTaunt
  } else {
    const out = themedEnemyTeam(enemyRng, {
      area, kind: ek, budget: Math.round(budgetB(depth) * budgetMult), count, excludeThemes,
    })
    enemyTeam = out.team
    themeId = out.themeId
  }

  // Stamp the displayed threat tier onto every enemy so they run through the same
  // leveling path as the player (battleReadyTeam / leveledStats) — a level-N enemy
  // now genuinely SHOWS level-N stats instead of flat level-1 stats + menace only.
  // enemyLevelFor already clamps to [1, levelMax]; carry it through verbatim.
  enemyTeam = enemyTeam.map((dw: DraftedWizard) => ({ ...dw, level: enemyLevel }))

  const relicCount = ek === 'boss' ? cb.enemyRelicsBoss : ek === 'elite' ? cb.enemyRelicsElite : 0
  const enemyRelics = relicCount > 0 ? selectEnemyRelics(combatFork.fork(depth + 200), relicCount) : []

  const detected = detectSynergies(enemyTeam)
  const synergyIds = bossSynergy
    ? [...detected.map(s => s.synergy.id), bossSynergy.synergy.id]
    : detected.map(s => s.synergy.id)

  const battle: NodeBattle = { enemyTeam, enemyRelics, enemyLevel, bossSynergy, unitDamageReduction, ignoresTaunt }
  const preview: NodePreview = {
    synergyIds,
    bossName: isFinalBoss ? BOSSES[0]!.name : isFirstBoss ? MURO.name : isBellatrixBoss ? BELLATRIX.name : undefined,
    bossHint: isFirstBoss
      ? 'Incassa i colpi diretti — il veleno lo ignora.'
      : isBellatrixBoss
        ? 'Ignora la provocazione — colpisce le retrovie.'
        : undefined,
  }
  return { battle, preview, themeId }
}
