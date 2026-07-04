import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EventScreen } from '@/components/screens/EventScreen'

const sampleEvent = {
  title: 'Un mercante misterioso',
  text: 'Uno strano mago ti offre uno scambio. Cosa fai?',
  choices: [
    { id: 'accept', label: 'Accetta lo scambio', enabled: true },
    { id: 'haggle', label: 'Contratta', enabled: false, reason: 'Richiede un mago Serpeverde nella squadra' },
    { id: 'decline', label: 'Rifiuta', enabled: true },
  ],
}

describe('EventScreen', () => {
  it('renders the event title, text, and a button per choice', () => {
    const onChoose = vi.fn()
    render(<EventScreen event={sampleEvent} onChoose={onChoose} />)
    expect(screen.getByText(sampleEvent.title)).toBeTruthy()
    expect(screen.getByText(sampleEvent.text)).toBeTruthy()
    for (const c of sampleEvent.choices) {
      expect(screen.getByRole('button', { name: new RegExp(c.label) })).toBeTruthy()
    }
  })

  it('disables a choice whose enabled=false and shows its reason', () => {
    const onChoose = vi.fn()
    render(<EventScreen event={sampleEvent} onChoose={onChoose} />)
    const disabledChoice = sampleEvent.choices.find(c => !c.enabled)!
    const btn = screen.getByRole('button', { name: new RegExp(disabledChoice.label) })
    expect(btn).toBeDisabled()
    expect(screen.getByText(disabledChoice.reason!)).toBeTruthy()
  })

  it('calls onChoose with the choice id when an enabled choice is clicked', async () => {
    const onChoose = vi.fn()
    render(<EventScreen event={sampleEvent} onChoose={onChoose} />)
    const enabledChoice = sampleEvent.choices.find(c => c.enabled)!
    await userEvent.click(screen.getByRole('button', { name: new RegExp(enabledChoice.label) }))
    expect(onChoose).toHaveBeenCalledWith(enabledChoice.id)
  })
})
