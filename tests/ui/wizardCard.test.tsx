import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WizardCard } from '@/components/cards/WizardCard'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARD_BY_ID } from '@/data/wizards'
import { SPELLS } from '@/data/spells'

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

  it('fires onClick when clickable', async () => {
    const handler = vi.fn()
    render(<WizardCard drafted={harry()} onClick={handler} />)
    await userEvent.click(screen.getByRole('button'))
    expect(handler).toHaveBeenCalledOnce()
  })

  it('shows the portrait and the house crest', () => {
    const drafted = harry()
    render(<WizardCard drafted={drafted} />)
    expect(screen.getByAltText(drafted.wizard.name)).toBeInTheDocument()
    expect(screen.getByRole('img', { name: drafted.wizard.house })).toBeInTheDocument()
  })

  it('wraps content in a rarity frame', () => {
    const { container } = render(<WizardCard drafted={harry()} />)
    expect(container.querySelector('[data-rarity]')).not.toBeNull()
  })

  it('shows an effect chip for a spell with a dot effect', () => {
    const incendio = SPELLS.find((s) => s.id === 'incendio')!
    const drafted = { ...harry(), spell: incendio }
    render(<WizardCard drafted={drafted} />)
    expect(screen.getByText('Danno nel tempo')).toBeInTheDocument()
  })
})
