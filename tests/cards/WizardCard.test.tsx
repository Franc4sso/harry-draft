import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WizardCard } from '@/components/cards/WizardCard'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARDS } from '@/data/wizards'

const drafted = (id: string) =>
  draftWizard(createRng(`wc-${id}`), WIZARDS.find(w => w.id === id)!, false)

describe('WizardCard', () => {
  it('mostra nome, magia e statistiche in densità piena', () => {
    const d = drafted('hermione')
    render(<WizardCard drafted={d} />)
    expect(screen.getByText(/Hermione/)).toBeInTheDocument()
    expect(screen.getByTestId('spell-headline')).toBeInTheDocument()
    expect(screen.getByTestId('stat-band')).toBeInTheDocument()
  })

  it('le tre densità mostrano tutte nome e statistiche', () => {
    for (const density of ['full', 'combat', 'row'] as const) {
      const { unmount } = render(<WizardCard drafted={drafted('hermione')} density={density} />)
      expect(screen.getByTestId('stat-band'), density).toBeInTheDocument()
      expect(screen.getByText(/Hermione/), density).toBeInTheDocument()
      unmount()
    }
  })

  it('la barra della vita compare solo con currentHp', () => {
    const d = drafted('hermione')
    const { unmount } = render(<WizardCard drafted={d} density="combat" />)
    expect(screen.queryByTestId('card-hp-bar')).not.toBeInTheDocument()
    unmount()
    render(<WizardCard drafted={d} density="combat" currentHp={40} />)
    expect(screen.getByTestId('card-hp-bar')).toBeInTheDocument()
  })

  it('in densità combat la descrizione della magia sparisce', () => {
    render(<WizardCard drafted={drafted('hermione')} density="combat" />)
    expect(screen.queryByTestId('spell-verb')).not.toBeInTheDocument()
  })

  it('il sigillo compare solo per i maghi con firma', () => {
    const { unmount } = render(<WizardCard drafted={drafted('goyle')} />)
    expect(screen.queryByTestId('ability-seal')).not.toBeInTheDocument()
    unmount()
    render(<WizardCard drafted={drafted('voldemort')} />)
    expect(screen.getByTestId('ability-seal')).toBeInTheDocument()
  })

  it('è cliccabile solo quando ha un onClick', () => {
    const { unmount } = render(<WizardCard drafted={drafted('hermione')} testId="c1" />)
    expect(screen.getByTestId('c1')).not.toHaveAttribute('role', 'button')
    unmount()
    render(<WizardCard drafted={drafted('hermione')} testId="c2" onClick={() => {}} />)
    expect(screen.getByTestId('c2')).toHaveAttribute('role', 'button')
  })
})
