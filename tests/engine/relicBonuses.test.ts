import { describe, it, expect } from 'vitest'
import { relicMatchesCondition, applyRelicBonuses, totalRelicRegen } from '@/game/engine/relics'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARD_BY_ID } from '@/data/wizards'
import type { ActiveRelic } from '@/types'

function team(ids: string[]) {
  const r = createRng(1)
  return ids.map(id => draftWizard(r, WIZARD_BY_ID[id]!))
}
const ar = (relic: ActiveRelic['relic']): ActiveRelic => ({ relic, stageObtained: 0 })

describe('relicMatchesCondition', () => {
  it('true when no condition', () => {
    expect(relicMatchesCondition(team(['harry']), undefined)).toBe(true)
  })
  it('counts house members against count', () => {
    // harry=Grifondoro, ron=Grifondoro, hermione=Grifondoro, draco=Serpeverde, luna=Corvonero
    // => 3 Grifondoro, satisfies count:3
    const gryffindor3 = team(['harry', 'ron', 'hermione', 'draco', 'luna'])
    expect(relicMatchesCondition(gryffindor3, { house: 'Grifondoro', count: 3 })).toBe(true)
    // draco alone => 0 Grifondoro => false
    expect(relicMatchesCondition(team(['draco']), { house: 'Grifondoro', count: 3 })).toBe(false)
  })
})

describe('applyRelicBonuses', () => {
  const base = { hp: 100, atk: 100, def: 100, spd: 100 }
  it('adds flat then percent for unconditional relics', () => {
    const relics = [
      ar({ id: 'a', name: 'a', desc: '', rarity: 'comune', bonus: { atk: 20 } }),
      ar({ id: 'b', name: 'b', desc: '', rarity: 'comune', bonus: { allPct: 0.1 } }),
    ]
    const out = applyRelicBonuses(base, team(['harry']), relics)
    expect(out.atk).toBe(Math.round((100 + 20) * 1.1))
    expect(out.hp).toBe(Math.round(100 * 1.1))
  })
  it('skips a relic whose condition is not met', () => {
    // harry/ron/hermione = 3 Grifondoro, 0 Serpeverde => condition not met
    const relics = [
      ar({ id: 'c', name: 'c', desc: '', rarity: 'rara', bonus: { atk: 50 }, condition: { house: 'Serpeverde', count: 3 } }),
    ]
    const out = applyRelicBonuses(base, team(['harry', 'ron', 'hermione']), relics)
    expect(out.atk).toBe(100)
  })
  it('ignores relics without a bonus', () => {
    const relics = [
      ar({ id: 'd', name: 'd', desc: '', rarity: 'epica', startOfBattle: [{ kind: 'shield', amount: 10 }] }),
    ]
    expect(applyRelicBonuses(base, team(['harry']), relics)).toEqual(base)
  })
})

describe('totalRelicRegen', () => {
  it('sums regen only for met conditions', () => {
    // relic e: no condition => always applies (regen 10)
    // relic f: requires 3 Serpeverde => team harry/ron/hermione has 0 => skipped
    const relics = [
      ar({ id: 'e', name: 'e', desc: '', rarity: 'comune', bonus: { regen: 10 } }),
      ar({ id: 'f', name: 'f', desc: '', rarity: 'rara', bonus: { regen: 99 }, condition: { house: 'Serpeverde', count: 3 } }),
    ]
    expect(totalRelicRegen(team(['harry', 'ron', 'hermione']), relics)).toBe(10)
  })
})
