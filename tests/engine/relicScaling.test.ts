import { describe, it, expect } from 'vitest'
import { applyRelicBonuses, keywordDamageMult, scalingStatBonus } from '@/game/engine/relics'
import type { ActiveRelic, Relic, Stats, DraftedWizard } from '@/types'

const atkJoker: Relic = {
  id: 'test-atk', name: 'T', desc: '', rarity: 'epica',
  scaling: { trigger: 'kill', stat: 'attack', per: 2, cap: 20 },
}
const velJoker: Relic = {
  id: 'test-vel', name: 'V', desc: '', rarity: 'epica', keywords: ['veleno'],
  scaling: { trigger: 'kill', stat: 'velenoMult', per: 0.03, cap: 0.45 },
}
const baseStats: Stats = { hp: 100, atk: 50, def: 10, spd: 10 }
const team: DraftedWizard[] = [] // scaling ignores team composition (no condition)

describe('relic scaling', () => {
  it('scalingStatBonus grows per counter and clamps at cap', () => {
    expect(scalingStatBonus(atkJoker, 5, 'attack')).toBe(10)   // 5*2
    expect(scalingStatBonus(atkJoker, 20, 'attack')).toBe(20)  // capped
    expect(scalingStatBonus(atkJoker, 0, 'attack')).toBe(0)
    expect(scalingStatBonus(atkJoker, undefined, 'attack')).toBe(0)
    expect(scalingStatBonus(atkJoker, 5, 'maxHp')).toBe(0)     // wrong stat
  })

  it('applyRelicBonuses adds scaled attack from runCounter', () => {
    const relics: ActiveRelic[] = [{ relic: atkJoker, stageObtained: 0, runCounter: 5 }]
    const out = applyRelicBonuses(baseStats, team, relics)
    expect(out.atk).toBe(60) // 50 + 5*2
  })

  it('keywordDamageMult adds scaled veleno mult from runCounter', () => {
    const relics: ActiveRelic[] = [{ relic: velJoker, stageObtained: 0, runCounter: 10 }]
    const mult = keywordDamageMult(team, relics, [], 'veleno')
    expect(mult).toBeCloseTo(1.30) // 1 + 10*0.03
  })

  it('scales defense and speed from scaling relics', () => {
    const defJoker: ActiveRelic = {
      relic: { id: 'dj', name: 'DJ', desc: '', rarity: 'epica',
        scaling: { trigger: 'battleWin', stat: 'defense', per: 5, cap: 50 } },
      stageObtained: 0, runCounter: 4,
    }
    const spdJoker: ActiveRelic = {
      relic: { id: 'sj', name: 'SJ', desc: '', rarity: 'epica',
        scaling: { trigger: 'battleWin', stat: 'speed', per: 8, cap: 64 } },
      stageObtained: 0, runCounter: 3,
    }
    const base = { hp: 100, atk: 10, def: 10, spd: 10 }
    const out = applyRelicBonuses(base, [], [defJoker, spdJoker])
    expect(out.def).toBe(10 + 20) // 4*5
    expect(out.spd).toBe(10 + 24) // 3*8
  })

  it('clamps scaled def/spd at cap', () => {
    const defJoker: ActiveRelic = {
      relic: { id: 'dj', name: 'DJ', desc: '', rarity: 'epica',
        scaling: { trigger: 'battleWin', stat: 'defense', per: 5, cap: 50 } },
      stageObtained: 0, runCounter: 100,
    }
    const out = applyRelicBonuses({ hp: 100, atk: 10, def: 10, spd: 10 }, [], [defJoker])
    expect(out.def).toBe(10 + 50)
  })
})
