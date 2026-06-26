import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WizardCardRow } from '@/components/cards/WizardCardRow'
import { WIZARD_BY_ID } from '@/data/wizards'
import { SIGNATURE_BY_ID } from '@/data/signatures'
import { SPELL_BY_ID } from '@/data/spells'

function drafted(id: string) {
  const wizard = WIZARD_BY_ID[id]!
  const spell = SPELL_BY_ID[wizard.spellPool[0]!]!
  return { wizard, stats: { hp: 100, atk: 20, def: 10, spd: 20 }, maxHp: 100, spell }
}

describe('WizardCardRow signature', () => {
  it('renders the wizard signature name', () => {
    render(<WizardCardRow drafted={drafted('dumbledore')} />)
    expect(screen.getByText(SIGNATURE_BY_ID['dumbledore']!.name)).toBeInTheDocument()
  })
})
