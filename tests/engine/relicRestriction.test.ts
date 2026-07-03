import { describe, it, expect, afterEach } from 'vitest'
import { offerRelics, setRelicPoolRestriction } from '@/game/engine/relics'
import { createRng } from '@/game/engine/rng'

afterEach(() => setRelicPoolRestriction(null))

describe('relic pool restriction', () => {
  it('never offers a relic outside the restriction set', () => {
    setRelicPoolRestriction(['giratempo'])
    const offer = offerRelics(createRng('seed-1').fork(1), [], 0)
    for (const r of offer) expect(r.id).toBe('giratempo')
  })
})
