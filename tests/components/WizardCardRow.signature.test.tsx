import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WizardCard } from '@/components/cards/WizardCard'
import { WIZARD_BY_ID } from '@/data/wizards'
import { SIGNATURE_BY_ID } from '@/data/signatures'
import { SPELL_BY_ID } from '@/data/spells'

function drafted(id: string) {
  const wizard = WIZARD_BY_ID[id]!
  const spell = SPELL_BY_ID[wizard.spellPool[0]!]!
  return { wizard, stats: { hp: 100, atk: 20, def: 10, spd: 20 }, maxHp: 100, spell }
}

// WizardCardRow (con la pill "Abilità" visibile in riga) è stato cancellato — Task 11.
// WizardCard density="row" non ha una pill Abilità dedicata (il brief del Task 8 scopra
// il corpo della riga a "nome, barra vita, statistiche compatte": niente firma — spazio
// stretto, ritratto 54px). La firma resta scopribile nelle densità full/combat via
// AbilitySeal (il sigillo sul ritratto, con nome+testo nel tooltip).
describe('WizardCard signature', () => {
  it('density row: shows no dedicated signature pill (moved out of the compact row)', () => {
    render(<WizardCard drafted={drafted('dumbledore')} density="row" />)
    expect(screen.queryByTestId('ability-seal')).not.toBeInTheDocument()
  })

  it('density full: renders the ability seal and reveals the signature name in its tooltip', () => {
    render(<WizardCard drafted={drafted('dumbledore')} density="full" />)
    const seal = screen.getByTestId('ability-seal')
    fireEvent.click(seal)
    expect(screen.getByText(SIGNATURE_BY_ID['dumbledore']!.name)).toBeInTheDocument()
  })
})
