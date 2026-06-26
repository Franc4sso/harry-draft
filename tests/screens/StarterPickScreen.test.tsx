import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StarterPickScreen } from '@/components/screens/StarterPickScreen'
import { starterOffer } from '@/game/engine/runEngine'

describe('StarterPickScreen', () => {
  it('requires exactly two picks before confirming', async () => {
    const offer = starterOffer('seed-sp', 'Grifondoro')
    const onConfirm = vi.fn()
    render(<StarterPickScreen house="Grifondoro" offer={offer} onConfirm={onConfirm} onBack={() => {}} />)
    const confirm = screen.getByRole('button', { name: /Inizia/ })
    expect(confirm).toBeDisabled()
    await userEvent.click(screen.getByTestId(`pick-${offer[0]!.wizard.id}`))
    await userEvent.click(screen.getByTestId(`pick-${offer[1]!.wizard.id}`))
    expect(confirm).toBeEnabled()
    await userEvent.click(confirm)
    expect(onConfirm).toHaveBeenCalledWith([offer[0]!.wizard.id, offer[1]!.wizard.id])
  })
})
