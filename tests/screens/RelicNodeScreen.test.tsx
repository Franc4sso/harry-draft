import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RelicNodeScreen } from '@/components/screens/RelicNodeScreen'
import { offerRelics } from '@/game/engine/relics'
import { createRng } from '@/game/engine/rng'

describe('RelicNodeScreen', () => {
  it('reports the picked relic', async () => {
    const offer = offerRelics(createRng('r'), [], 0)
    const onPick = vi.fn()
    render(<RelicNodeScreen offer={offer} owned={[]} team={[]} onPick={onPick} />)
    await userEvent.click(screen.getByTestId(`relic-${offer[0]!.id}`))
    await userEvent.click(screen.getByRole('button', { name: /Prendi/ }))
    expect(onPick).toHaveBeenCalledWith(offer[0]!.id, undefined)
  }, 15000)
})
