import { describe, it, expect } from 'vitest'
import { generateEnemyTeam, generateBossTeam, budgetForStage, powerOf } from '@/game/engine/combat/teamGen'
import { createRng } from '@/game/engine/rng'
import { BALANCE } from '@/data/constants'
import { BOSSES, MURO } from '@/data/bosses'

describe('teamGen', () => {
  it('builds a 5-wizard enemy team deterministically', () => {
    const a = generateEnemyTeam(createRng(1), budgetForStage(0)).map(d => d.wizard.id)
    const b = generateEnemyTeam(createRng(1), budgetForStage(0)).map(d => d.wizard.id)
    expect(a).toHaveLength(5)
    expect(a).toEqual(b)
  })
  it('later stages have higher budget', () => {
    expect(budgetForStage(4)).toBeGreaterThan(budgetForStage(0))
  })
  it('higher budget teams are stronger on average', () => {
    const weak = generateEnemyTeam(createRng(7), budgetForStage(0)).reduce((s, d) => s + powerOf(d), 0)
    const strong = generateEnemyTeam(createRng(7), budgetForStage(8)).reduce((s, d) => s + powerOf(d), 0)
    expect(strong).toBeGreaterThan(weak)
  })
  it('boss team applies hp multiplier to leader', () => {
    const boss = generateBossTeam(createRng(1), BOSSES[0]!)
    expect(boss).toHaveLength(5)
    const maxHp = Math.max(...boss.map(d => d.maxHp))
    expect(maxHp).toBeGreaterThan(120)
  })
  it('Muro fields unitCount override (3) instead of default teamSize', () => {
    const team = generateBossTeam(createRng(1), MURO)
    expect(team).toHaveLength(3)
  })
  it('boss without unitCount defaults to BALANCE.draft.teamSize', () => {
    const team = generateBossTeam(createRng(1), BOSSES[0]!)
    expect(team).toHaveLength(BALANCE.draft.teamSize)
    expect(BALANCE.draft.teamSize).toBe(5)
  })
})
