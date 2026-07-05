import type { ActiveSynergy, DraftedWizard, NodeBattle, NodePreview } from '@/types'
import { createRng } from '../rng'
import { themedEnemyTeam, generateBossTeam } from './teamGen'
import { enemyLevelFor, globalDepth, budgetB } from './threat'
import { detectSynergies } from '../synergy'
import { selectEnemyRelics } from '../relics'
import { BALANCE } from '@/data/constants'
import type { BossDef } from '@/data/bosses'
import { BOSSES, MURO, BELLATRIX, BOSSES_BY_AREA } from '@/data/bosses'

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

  // Seeded boss pick (Task 6): dedicated fork (salt 9001) so the choice is stable and
  // independent of the enemy/relic forks above. Pure/deterministic — never gated on
  // profile/unlock state; every pool member is always selectable by seed.
  const bossPick = (): BossDef => {
    const pool = BOSSES_BY_AREA[area] ?? [BOSSES[0]!]
    const idx = combatFork.fork(9001).int(0, pool.length - 1)
    return pool[idx]!
  }

  const budgetMult = ek === 'elite' ? cb.eliteBudgetMult : isBoss ? cb.bossBudgetMult : 1
  // Hard cap: never more than `maxEnemies` units in ANY encounter (user directive). The
  // config values above already respect it; this clamp is the structural guarantee.
  const count = Math.min(cb.maxEnemies, ek === 'normal'
    ? cb.normalEnemyCount
    : (cb.enemyCountByArea[area] ?? cb.enemyCountByArea[cb.enemyCountByArea.length - 1]!))

  let enemyTeam, themeId: string | null = null, bossSynergy: ActiveSynergy | undefined
  let unitDamageReduction: number | undefined
  let ignoresTaunt: boolean | undefined
  let pickedBoss: BossDef | undefined
  if (isFinalBoss) {
    const boss = bossPick()
    pickedBoss = boss
    enemyTeam = generateBossTeam(enemyRng, boss)
    bossSynergy = boss.exclusiveSynergy
      ? { synergy: boss.exclusiveSynergy, memberIds: enemyTeam.map(d => d.wizard.id) }
      : undefined
  } else if (isFirstBoss) {
    const boss = bossPick()
    pickedBoss = boss
    enemyTeam = generateBossTeam(enemyRng, boss)
    bossSynergy = boss.exclusiveSynergy
      ? { synergy: boss.exclusiveSynergy, memberIds: enemyTeam.map(d => d.wizard.id) }
      : undefined
    unitDamageReduction = boss.unitDamageReduction
  } else if (isBellatrixBoss) {
    const boss = bossPick()
    pickedBoss = boss
    enemyTeam = generateBossTeam(enemyRng, boss)
    bossSynergy = boss.exclusiveSynergy
      ? { synergy: boss.exclusiveSynergy, memberIds: enemyTeam.map(d => d.wizard.id) }
      : undefined
    ignoresTaunt = boss.ignoresTaunt
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

  // The boss's face for the map seal: the leader unit (guaranteed present in enemyTeam by
  // generateBossTeam when the boss has a bossWizardId). Leaderless bosses (Il Muro) have
  // no character portrait → undefined, and the map falls back to its emblem.
  const bossLeader = pickedBoss?.bossWizardId
    ? enemyTeam.find(d => d.wizard.id === pickedBoss.bossWizardId)
    : undefined

  const battle: NodeBattle = { enemyTeam, enemyRelics, enemyLevel, bossSynergy, unitDamageReduction, ignoresTaunt }
  const preview: NodePreview = {
    synergyIds,
    bossName: pickedBoss?.name,
    bossHint: pickedBoss?.unitDamageReduction != null
      ? 'Incassa i colpi diretti — il veleno lo ignora.'
      : pickedBoss?.ignoresTaunt
        ? 'Ignora la provocazione — colpisce le retrovie.'
        : undefined,
    bossFace: bossLeader ? { id: bossLeader.wizard.id, house: bossLeader.wizard.house } : undefined,
  }
  return { battle, preview, themeId }
}
