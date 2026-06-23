import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Chip } from '@/components/ui/Chip'

describe('Chip', () => {
  it('renders its label', () => {
    render(<Chip label="Stordimento" color="#C98BFF" />)
    expect(screen.getByText('Stordimento')).toBeInTheDocument()
  })
  it('renders with an icon without crashing', () => {
    render(<Chip label="Danno nel tempo" color="#FF7A7A" icon="Flame" />)
    expect(screen.getByText('Danno nel tempo')).toBeInTheDocument()
  })
})
