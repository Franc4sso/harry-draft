import { describe, it, expect } from 'vitest'
import { displayName } from '@/lib/displayName'
import { WIZARD_BY_ID } from '@/data/wizards'
import { fixedStats } from '@/game/engine/statRoll'
import { SPELL_BY_ID } from '@/data/spells'

function dw(id: string, shiny?: { traitId: string }) {
  const wizard = WIZARD_BY_ID[id]!
  const stats = fixedStats(wizard)
  return { wizard, stats, maxHp: stats.hp, spell: SPELL_BY_ID[wizard.spellPool[0]!]!, shiny }
}

describe('displayName', () => {
  it('returns the plain name when not shiny', () => {
    expect(displayName(dw('harry'))).toBe('Harry Potter')
  })
  it('appends the masculine epithet for a male wizard', () => {
    expect(displayName(dw('harry', { traitId: 'furia' }))).toBe('Harry Potter, il Furioso')
  })
  it('appends the feminine epithet for a female wizard', () => {
    expect(displayName(dw('hermione', { traitId: 'furia' }))).toBe('Hermione Granger, la Furiosa')
  })
})
