import { describe, it, expect } from 'vitest'
import { generateBossTeam } from '@/game/engine/combat/teamGen'
import { createRng } from '@/game/engine/rng'
import { BOSSES, BELLATRIX } from '@/data/bosses'

describe('boss identity — named boss guaranteed as a unit', () => {
  it('generateBossTeam(BELLATRIX) always includes a unit whose wizard.id is bellatrix', () => {
    for (let i = 0; i < 20; i++) {
      const team = generateBossTeam(createRng(`bellatrix-${i}`), BELLATRIX)
      expect(team.some(d => d.wizard.id === 'bellatrix')).toBe(true)
    }
  })

  it('generateBossTeam(voldemort_boss) always includes a unit whose wizard.id is voldemort', () => {
    for (let i = 0; i < 20; i++) {
      const team = generateBossTeam(createRng(`voldemort-${i}`), BOSSES[0]!)
      expect(team.some(d => d.wizard.id === 'voldemort')).toBe(true)
    }
  })

  it('the guaranteed boss wizard is the leader (carries the hpMult-boosted HP)', () => {
    const team = generateBossTeam(createRng('bellatrix-leader'), BELLATRIX)
    const leader = team.find(d => d.wizard.id === 'bellatrix')!
    const maxHp = Math.max(...team.map(d => d.maxHp))
    expect(leader.maxHp).toBe(maxHp)
  })

  it('team size still respects boss.unitCount when a wizard is injected', () => {
    const team = generateBossTeam(createRng('bellatrix-size'), BELLATRIX)
    expect(team).toHaveLength(BELLATRIX.unitCount!)
  })
})
