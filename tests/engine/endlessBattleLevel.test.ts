import { describe, it, expect } from 'vitest'
import { buildBattlePackage } from '@/game/engine/combat/battlePackage'
import { BALANCE } from '@/data/constants'

// Deep area/floor so the uncapped endless curve clearly exceeds levelMax.
const DEEP_AREA = 20
const DEEP_FLOOR = 3

describe('endless battle enemy level', () => {
  it('uses the uncapped endless level (exceeds levelMax) when endless=true', () => {
    const pkg = buildBattlePackage('ebl-seed', DEEP_AREA, DEEP_FLOOR, 'battle', [], true)
    expect(pkg.battle.enemyLevel).toBeGreaterThan(BALANCE.leveling.levelMax)
  })

  it('stays clamped to the campaign enemyLevelFor curve when endless is false/omitted', () => {
    const pkgExplicitFalse = buildBattlePackage('ebl-seed', DEEP_AREA, DEEP_FLOOR, 'battle', [], false)
    const pkgOmitted = buildBattlePackage('ebl-seed', DEEP_AREA, DEEP_FLOOR, 'battle')
    expect(pkgExplicitFalse.battle.enemyLevel).toBeLessThanOrEqual(BALANCE.leveling.levelMax)
    expect(pkgOmitted.battle.enemyLevel).toBeLessThanOrEqual(BALANCE.leveling.levelMax)
    expect(pkgExplicitFalse.battle.enemyLevel).toBe(pkgOmitted.battle.enemyLevel)
  })
})

describe('endless battle DISPLAYED enemy level (resolveCombat)', () => {
  it('reports the real uncapped endless level, not the campaign-clamped tier', async () => {
    const { resolveCombat } = await import('@/game/engine/resolvers/combat')
    const { generateArea } = await import('@/game/engine/map')
    const { createRng } = await import('@/game/engine/rng')
    const { offerRecruits, recruitVia } = await import('@/game/engine/recruit')
    const team = offerRecruits(createRng(1), { exclude: new Set() })
      .slice(0, 2).map(d => recruitVia(d, 'iniziale', 1))
    const map = generateArea(createRng(1).fork(4).fork(DEEP_AREA), 'ebl-seed', DEEP_AREA,
      { teamSize: 2, teamMax: 5 }, true)
    const state = { seed: 'ebl-seed', phase: 'map', team, activeSynergies: [], stage: 0,
      relics: [], map, currentNodeId: map[0]!.id, area: DEEP_AREA, teamMax: 5, log: [],
      pendingLevelUps: [], endless: true } as any
    const node = map.find(n => n.type === 'battle')!
    const out = resolveCombat(state, node, createRng('ebl-seed').fork(2))
    // The badge the battle UI shows must match the package's real (uncapped) level.
    expect(out.enemyLevel).toBe(node.battle!.enemyLevel)
    expect(out.enemyLevel).toBeGreaterThan(BALANCE.leveling.levelMax)
  })
})
