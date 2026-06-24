import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WizardCard } from '@/components/cards/WizardCard'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARD_BY_ID } from '@/data/wizards'

const harry = () => draftWizard(createRng(1), WIZARD_BY_ID['harry']!)

describe('WizardCard compact', () => {
  it('is the compact width and shows the name, house, and all four stat labels', () => {
    const { container } = render(<WizardCard drafted={harry()} />)
    expect(screen.getByText('Harry Potter')).toBeInTheDocument()
    for (const stat of ['HP', 'ATK', 'DIF', 'VEL']) {
      expect(screen.getByText(stat)).toBeInTheDocument()
    }
    expect(container.querySelector('.w-44')).not.toBeNull()
  })
})
