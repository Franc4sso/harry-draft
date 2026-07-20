import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

import { MenuScreen } from '@/components/screens/MenuScreen'
import { RulesScreen } from '@/components/screens/RulesScreen'
import { CreditsScreen } from '@/components/screens/CreditsScreen'
import { SPELLS } from '@/data/spells'
import { EFFECT_META, SPELL_TYPE_META } from '@/lib/glossary'

describe('MenuScreen', () => {
  it('shows the title and three actions', () => {
    render(<MenuScreen />)
    // Title letters are split into animated spans; the accessible name lives on the h1.
    expect(screen.getByRole('heading', { name: 'Harry Draft' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /gioca/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /compendio/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /credits/i })).toBeInTheDocument()
  }, 15000)
})

describe('RulesScreen', () => {
  it('renders rules headings and a back link', () => {
    render(<RulesScreen />)
    expect(screen.getByText(/draft/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /indietro|menu/i })).toBeInTheDocument()
  })
})

describe('Compendio (RulesScreen)', () => {
  it('renders the glossary terms', () => {
    render(<RulesScreen />)
    expect(screen.getAllByText('Controllo').length).toBeGreaterThan(0)
    expect(screen.getAllByText(EFFECT_META.stun!.label).length).toBeGreaterThan(0)
  })
  it('lists every spell by name under the Magie tab', async () => {
    render(<RulesScreen />)
    await userEvent.click(screen.getByRole('button', { name: 'Magie' }))
    for (const s of SPELLS) {
      expect(screen.getAllByText(s.name).length).toBeGreaterThan(0)
    }
  }, 15000)
  it('renders all glossary categories', () => {
    render(<RulesScreen />)
    // existing categories
    expect(screen.getByText('Tipi di magia')).toBeInTheDocument()
    expect(screen.getByText('Effetti di stato')).toBeInTheDocument()
    // new categories
    expect(screen.getByText('Rarità reliquie')).toBeInTheDocument()
  })
  it('renders rarity blurbs in glossary', () => {
    render(<RulesScreen />)
    expect(screen.getByText('Bonus base, sempre utile.')).toBeInTheDocument()
    expect(screen.getByText('Effetti potenti con trigger speciali.')).toBeInTheDocument()
  })
  it('defaults to the Come si gioca tab', () => {
    render(<RulesScreen />)
    // default tab shows the gameplay sections
    expect(screen.getByText(/draft/i)).toBeInTheDocument()
  })
})

describe('CreditsScreen', () => {
  it('renders credits and a back link', () => {
    render(<CreditsScreen />)
    expect(screen.getByRole('link', { name: /indietro|menu/i })).toBeInTheDocument()
  })
})
