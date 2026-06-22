import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WizardCard } from '@/components/cards/WizardCard'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARD_BY_ID } from '@/data/wizards'

const harry = draftWizard(createRng(1), WIZARD_BY_ID['harry']!)

describe('WizardCard', () => {
  it('shows name, house, role and spell', () => {
    render(<WizardCard drafted={harry} />)
    expect(screen.getByText(harry.wizard.name)).toBeInTheDocument()
    expect(screen.getByText(harry.wizard.house)).toBeInTheDocument()
    expect(screen.getByLabelText(harry.wizard.role)).toBeInTheDocument()
    expect(screen.getByText(harry.spell.name)).toBeInTheDocument()
  })
  it('renders the four stat labels', () => {
    render(<WizardCard drafted={harry} />)
    for (const label of ['HP', 'ATK', 'DEF', 'VEL']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })
  it('fires onClick when clickable', async () => {
    const onClick = vi.fn()
    render(<WizardCard drafted={harry} onClick={onClick} />)
    await userEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledOnce()
  })
})
