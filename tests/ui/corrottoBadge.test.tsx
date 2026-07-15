import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WizardCardColumn } from '@/components/cards/WizardCardColumn'
import { WizardCardRow } from '@/components/cards/WizardCardRow'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARD_BY_ID } from '@/data/wizards'

const drafted = () => draftWizard(createRng(1), WIZARD_BY_ID['harry']!)

describe('Corrotto badge', () => {
  it('WizardCardColumn: mostra il badge quando corrotto=true, con testo "non curabile"', () => {
    render(<WizardCardColumn drafted={{ ...drafted(), corrotto: true }} />)
    const badge = screen.getByTestId('corrotto-badge')
    expect(badge).toHaveTextContent(/corrotto/i)
    expect(badge).toHaveTextContent(/non curabile/i)
  })

  it('WizardCardColumn: nessun badge quando non corrotto', () => {
    render(<WizardCardColumn drafted={drafted()} />)
    expect(screen.queryByTestId('corrotto-badge')).toBeNull()
  })

  it('WizardCardRow (roster/battaglia): mostra il badge quando corrotto=true', () => {
    render(<WizardCardRow drafted={{ ...drafted(), corrotto: true }} />)
    const badge = screen.getByTestId('corrotto-badge')
    expect(badge).toHaveTextContent(/corrotto/i)
    expect(badge).toHaveTextContent(/non curabile/i)
  })

  it('WizardCardRow: nessun badge quando non corrotto', () => {
    render(<WizardCardRow drafted={drafted()} />)
    expect(screen.queryByTestId('corrotto-badge')).toBeNull()
  })
})
