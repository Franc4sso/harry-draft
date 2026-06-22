import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TierBadge } from '@/components/cards/TierBadge'
import { RoleIcon } from '@/components/cards/RoleIcon'

describe('TierBadge', () => {
  it('shows the tier label', () => {
    render(<TierBadge tier={1} />)
    expect(screen.getByText('Leggendario')).toBeInTheDocument()
  })
})

describe('RoleIcon', () => {
  it('renders an accessible icon for the role', () => {
    render(<RoleIcon role="Tank" />)
    expect(screen.getByLabelText('Tank')).toBeInTheDocument()
  })
})
