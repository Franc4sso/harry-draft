import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { DraftedWizard } from '@/types'
import { LoadoutPanel } from '@/components/run/LoadoutPanel'

// Uses real spell IDs so SPELL_BY_ID lookups return proper entries.
const member = {
  wizard: {
    id: 'harry',
    name: 'Harry',
    house: 'Grifondoro',
    role: 'Attaccante',
    tier: 1,
    gender: 'm',
    ranges: { hp: [1, 1], atk: [1, 1], def: [1, 1], spd: [1, 1] },
    spellPool: ['expelliarmus', 'stupeficium'],
    tags: [],
  },
  stats: { hp: 10, atk: 5, def: 3, spd: 4 },
  maxHp: 10,
  spell: { id: 'expelliarmus', name: 'Expelliarmus', desc: 'Disarma il bersaglio.', type: 'Attacco', hitChance: 0.95 },
} as unknown as DraftedWizard

describe('LoadoutPanel', () => {
  it('shows the current spell name', () => {
    render(<LoadoutPanel team={[member]} onSetSpell={vi.fn()} />)
    expect(screen.getByText('Expelliarmus')).toBeInTheDocument()
  })

  it('expands to show spell pool on click, then calls onSetSpell', () => {
    const spy = vi.fn()
    render(<LoadoutPanel team={[member]} onSetSpell={spy} />)

    // Click the wizard row to expand
    fireEvent.click(screen.getByRole('button', { expanded: false }))

    // Both pool spells should now be visible as buttons
    const stupeficiumBtn = screen.getByRole('button', { name: 'Stupeficium' })
    fireEvent.click(stupeficiumBtn)

    expect(spy).toHaveBeenCalledWith('harry', 'stupeficium')
  })
})
