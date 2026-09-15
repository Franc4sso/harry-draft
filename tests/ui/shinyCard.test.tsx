import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WizardCard } from '@/components/cards/WizardCard'
import { WIZARD_BY_ID } from '@/data/wizards'
import { fixedStats } from '@/game/engine/statRoll'
import { SPELL_BY_ID } from '@/data/spells'
import { TRAIT_BY_ID } from '@/data/traits'

function dw(id: string, shiny?: { traitId: string }) {
  const wizard = WIZARD_BY_ID[id]!
  const stats = fixedStats(wizard)
  return { wizard, stats, maxHp: stats.hp, spell: SPELL_BY_ID[wizard.spellPool[0]!]!, shiny }
}

// WizardCardRow è stato sostituito da WizardCard density="row" (Task 11).
describe('WizardCard shiny (density row)', () => {
  it('shows the epithet name and exposes the trait via the shiny foil tooltip', () => {
    render(<WizardCard drafted={dw('harry', { traitId: 'furia' })} density="row" />)
    expect(screen.getByText(/Harry Potter, il Furioso/)).toBeInTheDocument()
    // nessuna pill tratto blu
    expect(screen.queryByTestId('trait-chip')).not.toBeInTheDocument()
    // il tratto è nel tooltip del marcatore foil
    fireEvent.click(screen.getByTestId('shiny-foil'))
    expect(screen.getByText(new RegExp(TRAIT_BY_ID['furia']!.name))).toBeInTheDocument()
  })
  it('shows the plain name and no trait chip when not shiny', () => {
    render(<WizardCard drafted={dw('harry')} density="row" />)
    expect(screen.getByText('Harry Potter')).toBeInTheDocument()
    expect(screen.queryByText(TRAIT_BY_ID['furia']!.name)).not.toBeInTheDocument()
  })
})
