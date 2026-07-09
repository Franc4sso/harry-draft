import { describe, it, expect } from 'vitest'
import { recruitVia } from '@/game/engine/recruit'
import { expForLevel } from '@/game/engine/leveling'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARDS } from '@/data/wizards'

describe('recruitVia level', () => {
  it('enters at the given target level with coherent exp (does not regress to 1)', () => {
    const rng = createRng('recruit-seed')
    const dw = draftWizard(rng, WIZARDS[0]!, true)
    const recruit = recruitVia(dw, 'Reclutamento', 7)
    expect(recruit.level).toBe(7)
    expect(recruit.exp).toBe(expForLevel(7))
  })

  it('defaults are not level 1 when a higher target is passed', () => {
    const rng = createRng('recruit-seed-2')
    const dw = draftWizard(rng, WIZARDS[0]!, true)
    expect(recruitVia(dw, 'x', 5).level).toBe(5)
  })
})
