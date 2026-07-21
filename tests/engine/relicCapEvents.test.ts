import { describe, it, expect } from 'vitest'
import { applyEventEffects } from '@/game/engine/events'
import { startRunB, starterOffer, chooseStarters } from '@/game/engine/runEngine'
import { createRng } from '@/game/engine/rng'
import { powerOf } from '@/game/engine/combat/teamGen'
import { RULE_BREAKING_RELIC_IDS } from '@/data/relics'
import { BALANCE } from '@/data/constants'
import type { EventEffect } from '@/data/events'
import type { ActiveRelic, RunState } from '@/types'
import type { RelicRarity } from '@/types/relic'

/** Build a realistic RunState with a 3-wizard team via the real house/starter flow
 *  (mirrors eventEffects.test.ts / campaignBalanceRestricted.test.ts). */
function buildState(seed = 'events-cap-test'): RunState {
  let s = startRunB(seed)
  const offer = starterOffer(seed, 'Grifondoro')
  const starterIds = [...offer].sort((a, b) => powerOf(b) - powerOf(a)).slice(0, 3).map(d => d.wizard.id)
  s = chooseStarters(s, 'Grifondoro', starterIds, createRng(seed))
  return s
}

const mkRelic = (id: string, rarity: RelicRarity, stageObtained: number): ActiveRelic => ({
  relic: { id, name: id, desc: '', rarity, bonus: {} },
  stageObtained,
})

describe('grantRelic rispetta il cap (BALANCE.relics.maxRelics)', () => {
  it('a 5 reliquie scarta la peggiore invece di superare il cap', () => {
    let s = buildState()
    expect(BALANCE.relics.maxRelics).toBe(5)
    // Fill up to the cap with 5 relics of increasing rarity/age so the worst
    // (id 'a', comune, oldest) is the unambiguous drop candidate.
    s = {
      ...s,
      relics: [
        mkRelic('a', 'comune', 0),
        mkRelic('b', 'comune', 1),
        mkRelic('c', 'rara', 2),
        mkRelic('d', 'epica', 3),
        mkRelic('e', 'non-comune', 4),
      ],
    }
    expect(s.relics).toHaveLength(5)

    const effects: EventEffect[] = [{ kind: 'grantRelic', pool: 'ruleBreaking' }]
    const r = applyEventEffects(s, effects, createRng('cap-relic'))

    // Cap respected: still 5, never 6.
    expect(r.state.relics).toHaveLength(5)
    // The worst relic ('a', comune, oldest) was dropped.
    expect(r.state.relics.some(a => a.relic.id === 'a')).toBe(false)
    // The other pre-existing relics survive.
    for (const id of ['b', 'c', 'd', 'e']) {
      expect(r.state.relics.some(a => a.relic.id === id)).toBe(true)
    }
    // A new rule-breaking relic was actually granted.
    const grantedIds = r.state.relics.map(a => a.relic.id)
    const newRelicId = grantedIds.find(id => !['b', 'c', 'd', 'e'].includes(id))
    expect(newRelicId).toBeTruthy()
    expect(RULE_BREAKING_RELIC_IDS).toContain(newRelicId)
    // Log records the drop.
    expect(r.log.some(line => line.startsWith('grantRelic') && line.includes('scartata a'))).toBe(true)
  })

  it('sotto il cap continua a fare semplice append (nessuna reliquia scartata)', () => {
    const s = buildState()
    expect(s.relics.length).toBeLessThan(BALANCE.relics.maxRelics)
    const effects: EventEffect[] = [{ kind: 'grantRelic', pool: 'ruleBreaking' }]
    const r = applyEventEffects(s, effects, createRng('below-cap'))
    expect(r.state.relics.length).toBe(s.relics.length + 1)
    expect(r.log.some(line => line.includes('scartata'))).toBe(false)
  })
})
