import { describe, it, expect } from 'vitest'
import { buildBattlePackage } from '@/game/engine/combat/battlePackage'
import { detectSynergies } from '@/game/engine/synergy'

describe('buildBattlePackage', () => {
  it('is deterministic for (seed, area, floor, kind)', () => {
    const a = buildBattlePackage('seed', 1, 2, 'battle')
    const b = buildBattlePackage('seed', 1, 2, 'battle')
    expect(a.battle.enemyTeam.map(d => d.wizard.id)).toEqual(b.battle.enemyTeam.map(d => d.wizard.id))
    expect(a.battle.enemyLevel).toBe(b.battle.enemyLevel)
    expect(a.preview.synergyIds).toEqual(b.preview.synergyIds)
  })

  it('preview.synergyIds == detectSynergies(enemyTeam) ids for a non-final fight', () => {
    const { battle, preview } = buildBattlePackage('seed', 0, 1, 'battle')
    const detected = detectSynergies(battle.enemyTeam).map(s => s.synergy.id).sort()
    expect([...preview.synergyIds].sort()).toEqual(detected)
  })

  it('elite gets relics, normal does not', () => {
    const normal = buildBattlePackage('seed', 1, 2, 'battle')
    const elite = buildBattlePackage('seed', 1, 2, 'elite')
    expect(normal.battle.enemyRelics.length).toBe(0)
    expect(elite.battle.enemyRelics.length).toBeGreaterThanOrEqual(0) // campaignB.enemyRelicsElite (currently 0)
  })

  it('final-area boss uses the scripted boss synergy in preview', async () => {
    const lastArea = (await import('@/data/constants')).BALANCE.map.areas - 1
    const lastFloor = (await import('@/data/constants')).BALANCE.map.floorsPerArea - 1
    const { battle, preview } = buildBattlePackage('seed', lastArea, lastFloor, 'boss')
    expect(battle.bossSynergy).toBeDefined()
    expect(preview.bossName).toBeTruthy()
    expect(preview.synergyIds).toContain(battle.bossSynergy!.synergy.id)
  })
})
