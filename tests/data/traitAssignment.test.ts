import { describe, it, expect } from 'vitest'
import { WIZARDS } from '@/data/wizards'

describe('wizard trait data', () => {
  it('no wizard carries fixed traits any more (traits come from shiny rolls)', () => {
    for (const w of WIZARDS) expect(w.traits ?? []).toHaveLength(0)
  })
})
