import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WizardCard } from '@/components/cards/WizardCard'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARD_BY_ID } from '@/data/wizards'
import { SPELLS } from '@/data/spells'

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
  it('shows the spell description and an effect chip', () => {
    const incendio = SPELLS.find(s => s.id === 'incendio')!  // has a dot effect
    const drafted = { ...harry, spell: incendio }
    render(<WizardCard drafted={drafted} />)
    expect(screen.getByText(incendio.desc)).toBeInTheDocument()
    expect(screen.getByText('Danno nel tempo')).toBeInTheDocument()
  })
  it('shows the portrait and the house crest', () => {
    render(<WizardCard drafted={harry} />)
    // portrait alt = wizard name
    expect(screen.getByAltText(harry.wizard.name)).toBeInTheDocument()
    // house crest present
    expect(screen.getByRole('img', { name: harry.wizard.house })).toBeInTheDocument()
  })
  it('wraps content in a rarity frame keyed to the wizard tier', () => {
    const { container } = render(<WizardCard drafted={harry} />)
    expect(container.querySelector(`[data-rarity]`)).toBeTruthy()
  })
})
