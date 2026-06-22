import { describe, it, expect } from 'vitest'
import { rollStats, pickSpell, draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARD_BY_ID } from '@/data/wizards'

const harry = WIZARD_BY_ID['harry']!

describe('statRoll', () => {
  it('rolls stats within wizard ranges', () => {
    const r = createRng(1)
    for (let i = 0; i < 50; i++) {
      const s = rollStats(r, harry)
      for (const k of ['hp', 'atk', 'def', 'spd'] as const) {
        const [lo, hi] = harry.ranges[k]
        expect(s[k]).toBeGreaterThanOrEqual(lo)
        expect(s[k]).toBeLessThanOrEqual(hi)
      }
    }
  })
  it('is deterministic per seed', () => {
    expect(rollStats(createRng(5), harry)).toEqual(rollStats(createRng(5), harry))
  })
  it('pickSpell returns a spell from the pool', () => {
    const s = pickSpell(createRng(3), harry)
    expect(harry.spellPool).toContain(s.id)
  })
  it('draftWizard sets maxHp to rolled hp', () => {
    const dw = draftWizard(createRng(7), harry)
    expect(dw.maxHp).toBe(dw.stats.hp)
    expect(dw.wizard.id).toBe('harry')
  })
})
