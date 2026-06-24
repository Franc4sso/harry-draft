import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WizardCard } from '@/components/cards/WizardCard'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARD_BY_ID } from '@/data/wizards'
import { SPELLS } from '@/data/spells'

const harry = () => draftWizard(createRng(1), WIZARD_BY_ID['harry']!)

describe('WizardCard compact', () => {
  it('is the compact width and shows the name and all four stat labels', () => {
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

  it('conveys the house via a house frame (not a text pill)', () => {
    const drafted = harry()
    const { container } = render(<WizardCard drafted={drafted} />)
    // The house is conveyed by the frame, which carries the house name for a11y.
    expect(container.querySelector(`[data-house="${drafted.wizard.house}"]`)).not.toBeNull()
    // No standalone text pill repeating the house name in the affiliation strip.
    const strip = screen.queryByTestId('affiliation-strip')
    if (strip) expect(within(strip).queryByText(drafted.wizard.house)).toBeNull()
  })

  it('conveys the role as an icon badge, not a text pill', () => {
    const drafted = harry()
    render(<WizardCard drafted={drafted} />)
    // RoleIcon exposes the role as its aria-label.
    expect(screen.getByLabelText(drafted.wizard.role)).toBeInTheDocument()
    const strip = screen.queryByTestId('affiliation-strip')
    if (strip) expect(within(strip).queryByText(drafted.wizard.role)).toBeNull()
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

  it('shows only special-synergy chips in the affiliation strip (no house/role pills)', () => {
    // Harry belongs to Golden Trio (a special group synergy).
    render(<WizardCard drafted={harry()} />)
    const strip = screen.queryByTestId('affiliation-strip')
    expect(strip).not.toBeNull()
    expect(within(strip!).getByText(/Golden Trio/i)).toBeInTheDocument()
  })

  it('shows an effect chip for a spell with a dot effect', () => {
    const incendio = SPELLS.find((s) => s.id === 'incendio')!
    const drafted = { ...harry(), spell: incendio }
    render(<WizardCard drafted={drafted} />)
    expect(screen.getByText('Danno nel tempo')).toBeInTheDocument()
  })
})
