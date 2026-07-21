import { describe, it, expect } from 'vitest'
import { synergyBonusText } from '@/lib/glossary'
import { SYNERGIES } from '@/data/synergies'

const byId = (id: string) => SYNERGIES.find(s => s.id === id)!

describe('synergyBonusText with full Synergy', () => {
  it('tossicita: keywordMult bonus has no flat/regen/allPct text (unformatted keyword)', () => {
    expect(synergyBonusText(byId('tossicita'))).toEqual([])
  })
})
