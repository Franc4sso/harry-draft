import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HouseCrest } from '@/components/ui/HouseCrest'

describe('HouseCrest', () => {
  it('renders an accessible crest per house', () => {
    render(<HouseCrest house="Grifondoro" />)
    const el = screen.getByRole('img', { name: 'Grifondoro' })
    expect(el).toHaveAttribute('data-house', 'Grifondoro')
  })
  it('supports all four houses', () => {
    for (const h of ['Grifondoro', 'Serpeverde', 'Corvonero', 'Tassorosso'] as const) {
      const { unmount } = render(<HouseCrest house={h} />)
      expect(screen.getByRole('img', { name: h })).toBeInTheDocument()
      unmount()
    }
  })
})
