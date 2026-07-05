import { describe, it, expect } from 'vitest'
import { RELICS, RELIC_BY_ID, SCALING_RELIC_IDS } from '@/data/relics'
import { STARTER_RELICS } from '@/data/unlocks'
import { selectEnemyRelics } from '@/game/engine/relics'
import { createRng } from '@/game/engine/rng'

const JOKERS = ['fame-vorace', 'collezionista-anime', 'marchio-vorace']

describe('scaling jokers data', () => {
  it('defines all three jokers with a valid scaling descriptor', () => {
    for (const id of JOKERS) {
      const r = RELIC_BY_ID[id]
      expect(r, id).toBeDefined()
      expect(r!.scaling, id).toBeDefined()
      expect(r!.scaling!.trigger).toBe('kill')
      expect(r!.scaling!.per).toBeGreaterThan(0)
      expect(r!.scaling!.cap).toBeGreaterThan(0)
    }
    expect(RELIC_BY_ID['marchio-vorace']!.keywords).toContain('veleno')
    expect(SCALING_RELIC_IDS.sort()).toEqual([...JOKERS].sort())
  })

  it('makes jokers available in real play (STARTER_RELICS)', () => {
    for (const id of JOKERS) expect(STARTER_RELICS, id).toContain(id)
  })

  it('never arms an enemy team with an (inert) scaling joker', () => {
    // Ask for the whole pool; scaling relics must be filtered out.
    const picked = selectEnemyRelics(createRng('enemy-seed'), RELICS.length)
    const ids = picked.map(p => p.relic.id)
    for (const id of JOKERS) expect(ids, id).not.toContain(id)
  })
})
