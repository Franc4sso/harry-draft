import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

import { MenuScreen } from '@/components/screens/MenuScreen'
import { RulesScreen } from '@/components/screens/RulesScreen'
import { CreditsScreen } from '@/components/screens/CreditsScreen'

describe('MenuScreen', () => {
  it('shows the title and three actions', () => {
    render(<MenuScreen />)
    expect(screen.getByText('Harry Draft')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /gioca/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /regole/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /credits/i })).toBeInTheDocument()
  })
})

describe('RulesScreen', () => {
  it('renders rules headings and a back link', () => {
    render(<RulesScreen />)
    expect(screen.getByText(/draft/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /indietro|menu/i })).toBeInTheDocument()
  })
})

describe('CreditsScreen', () => {
  it('renders credits and a back link', () => {
    render(<CreditsScreen />)
    expect(screen.getByRole('link', { name: /indietro|menu/i })).toBeInTheDocument()
  })
})
