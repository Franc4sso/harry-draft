import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HouseSelectScreen } from '@/components/screens/HouseSelectScreen'

describe('HouseSelectScreen', () => {
  it('renders the 4 houses and reports the chosen one', async () => {
    const onSelect = vi.fn()
    render(<HouseSelectScreen onSelect={onSelect} />)
    for (const label of ['Grifondoro', 'Serpeverde', 'Corvonero', 'Tassorosso']) {
      expect(screen.getByRole('button', { name: new RegExp(label) })).toBeInTheDocument()
    }
    await userEvent.click(screen.getByRole('button', { name: /Corvonero/ }))
    expect(onSelect).toHaveBeenCalledWith('Corvonero')
  })
})
