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
    // The spell name shows once, in the spell block (the ability plate now
    // shows the wizard's Signature, a separate name, via abilityFor).
    expect(screen.getByText(d.spell.name)).toBeInTheDocument()
    for (const l of ['HP', 'ATT', 'DIF', 'VEL']) expect(screen.getByText(l)).toBeInTheDocument()
  })
  it('renders without the affiliation strip (removed per approved mockup)', () => {
    render(<WizardCardColumn drafted={harry()} />)
    expect(screen.queryByTestId('affiliation-strip')).toBeNull()
  })
  it('fires onClick when clicked', () => {
    const onClick = vi.fn()
    render(<WizardCardColumn drafted={harry()} onClick={onClick} testId="col-0" />)
    screen.getByTestId('col-0').click()
    expect(onClick).toHaveBeenCalled()
  })
})
