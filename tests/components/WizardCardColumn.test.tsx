import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WizardCardColumn } from '@/components/cards/WizardCardColumn'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARD_BY_ID } from '@/data/wizards'
import { displayName } from '@/lib/displayName'

const harry = () => draftWizard(createRng(1), WIZARD_BY_ID['harry']!)

describe('WizardCardColumn', () => {
  it('renders name, spell name, and the four stat labels', () => {
    const d = harry()
    render(<WizardCardColumn drafted={d} testId="col-0" />)
    expect(screen.getByTestId('col-0')).toBeInTheDocument()
    expect(screen.getByText(displayName(d))).toBeInTheDocument()
    expect(screen.getByText(d.spell.name)).toBeInTheDocument()
    for (const l of ['HP', 'ATK', 'DIF', 'VEL']) expect(screen.getByText(l)).toBeInTheDocument()
  })
  it('exposes the affiliation strip with special synergies', () => {
    render(<WizardCardColumn drafted={harry()} />)
    expect(screen.getByTestId('affiliation-strip')).toBeInTheDocument()
  })
  it('marks a hot synergy chip', () => {
    render(<WizardCardColumn drafted={harry()} hotSynergyIds={new Set(['goldenTrio'])} />)
    expect(screen.getByTestId('affiliation-strip').querySelector('[data-synergy="goldenTrio"][data-hot]')).not.toBeNull()
  })
  it('fires onClick when clicked', () => {
    const onClick = vi.fn()
    render(<WizardCardColumn drafted={harry()} onClick={onClick} testId="col-0" />)
    screen.getByTestId('col-0').click()
    expect(onClick).toHaveBeenCalled()
  })
})
