import { describe, it, expect } from 'vitest'
import { generateEnemyTeam, generateBossTeam, budgetForStage, powerOf } from '@/game/engine/combat/teamGen'
import { createRng } from '@/game/engine/rng'
import { BALANCE } from '@/data/constants'
import { BOSSES, MURO } from '@/data/bosses'
import type { BossDef } from '@/data/bosses'

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
    // Voldemort (final boss) now carries its own unitCount override (2, area-0/final-boss
    // action-economy rebalance — see campaignBalanceB.test.ts calibration history), so this
    // exercises the boss.unitCount path rather than the BALANCE.draft.teamSize default.
    const boss = generateBossTeam(createRng(1), BOSSES[0]!)
    expect(boss).toHaveLength(BOSSES[0]!.unitCount ?? BALANCE.draft.teamSize)
    const maxHp = Math.max(...boss.map(d => d.maxHp))
    expect(maxHp).toBeGreaterThan(120)
  })
  it('Muro fields unitCount override (3) instead of default teamSize', () => {
    const team = generateBossTeam(createRng(1), MURO)
    expect(team).toHaveLength(3)
  })
  it('boss without unitCount defaults to BALANCE.draft.teamSize', () => {
    // A synthetic boss (no unitCount field) exercises the `?? BALANCE.draft.teamSize`
    // fallback directly — every scripted boss in data/bosses.ts now carries an explicit
    // unitCount override, so none of them can exercise the default path any more.
    const noOverrideBoss: BossDef = { id: 'test_boss', name: 'Test Boss', budget: 900, hpMult: 1 }
    const team = generateBossTeam(createRng(1), noOverrideBoss)
    expect(team).toHaveLength(BALANCE.draft.teamSize)
    expect(BALANCE.draft.teamSize).toBe(5)
  })
})
