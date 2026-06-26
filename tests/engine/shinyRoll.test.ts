import { describe, it, expect } from 'vitest'
import { createRng } from '@/game/engine/rng'
import { draftWizard } from '@/game/engine/statRoll'
import { WIZARD_BY_ID } from '@/data/wizards'
import { SHINY_TRAIT_IDS } from '@/data/traits'

const harry = WIZARD_BY_ID['harry']!

describe('draftWizard shiny roll', () => {
  it('is deterministic for a given seed', () => {
    const a = draftWizard(createRng('seed-x'), harry)
    const b = draftWizard(createRng('seed-x'), harry)
    expect(a.shiny).toEqual(b.shiny)
  })

  it('rolls shiny at roughly the configured rate, always a valid trait', () => {
    let shinies = 0
    const N = 20000
    for (let i = 0; i < N; i++) {
      const d = draftWizard(createRng(`seed-${i}`), harry)
      if (d.shiny) {
        shinies++
        expect(SHINY_TRAIT_IDS).toContain(d.shiny.traitId)
      }
    }
    const rate = shinies / N
    // configured 0.015; allow a generous band for sampling noise
    expect(rate).toBeGreaterThan(0.008)
    expect(rate).toBeLessThan(0.025)
  })
})
