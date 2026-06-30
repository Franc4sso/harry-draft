import { describe, it, expect } from 'vitest'
import { TRAIT_BY_ID, SHINY_TRAIT_IDS } from '@/data/traits'

describe('venom trait removed', () => {
  it('is no longer a trait', () => {
    expect(TRAIT_BY_ID['veleno']).toBeUndefined()
  })
  it('is no longer draftable as a shiny', () => {
    expect(SHINY_TRAIT_IDS).not.toContain('veleno')
  })
})
