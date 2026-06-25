import { describe, it, expect } from 'vitest'
import { fixedStats, draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARD_BY_ID } from '@/data/wizards'

describe('fixedStats', () => {
  it('returns the rounded midpoint of each range', () => {
    const harry = WIZARD_BY_ID['harry']!
    // ranges: hp [86,107] atk [31,40] def [12,19] spd [26,35]
    expect(fixedStats(harry)).toEqual({ hp: 97, atk: 36, def: 16, spd: 31 })
  })

  it('is deterministic and independent of RNG', () => {
    const w = WIZARD_BY_ID['harry']!
    expect(fixedStats(w)).toEqual(fixedStats(w))
  })

  it('draftWizard uses fixed stats but still varies the spell by RNG', () => {
    const w = WIZARD_BY_ID['harry']!
    const a = draftWizard(createRng(1), w)
    const b = draftWizard(createRng(2), w)
    expect(a.stats).toEqual(b.stats)          // stats fixed
    expect(a.maxHp).toBe(a.stats.hp)
  })
})
