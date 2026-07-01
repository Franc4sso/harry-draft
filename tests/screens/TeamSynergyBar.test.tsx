import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TeamSynergyBar } from '@/components/run/TeamSynergyBar'

const team = [
  { wizard: { id: 'a', name: 'Harry', house: 'Grifondoro' }, level: 3, stats: {}, maxHp: 100, spell: { id: 'x' } },
  { wizard: { id: 'b', name: 'Ron', house: 'Grifondoro' }, level: 1, stats: {}, maxHp: 100, spell: { id: 'y' } },
] as any

// Uses real spell IDs so the row's SPELL_BY_ID lookups resolve to proper
// entries (name, desc), and a real Role so RoleIcon has a valid icon to render.
const memberWithPool = {
  wizard: {
    id: 'harry',
    name: 'Harry',
    house: 'Grifondoro',
    role: 'Attaccante',
    spellPool: ['expelliarmus', 'stupeficium'],
  },
  level: 2,
  stats: {},
  maxHp: 100,
  spell: { id: 'expelliarmus', name: 'Expelliarmus', desc: 'Disarma il bersaglio.', type: 'Attacco', hitChance: 0.95 },
} as any

const synergies = [
  { synergy: { id: 's', name: 'Coraggio', bonus: { atk: 10 } }, memberIds: ['a', 'b'] },
] as any

describe('TeamSynergyBar', () => {
  it('renders each member with name and level, plus synergies', () => {
    render(<TeamSynergyBar team={team} synergies={synergies} />)
    expect(screen.getByText('Harry')).toBeInTheDocument()
    expect(screen.getByText('Ron')).toBeInTheDocument()
    expect(screen.getByText(/Lv\.?\s*3/i)).toBeInTheDocument()
    expect(screen.getByText(/Lv\.?\s*1/i)).toBeInTheDocument()
    expect(screen.getByText(/Coraggio/)).toBeInTheDocument()
  })

  it('defaults missing level to 1 and tolerates synergies without a bonus', () => {
    const noLevel = [{ wizard: { id: 'c', name: 'Hermione', house: 'Grifondoro' }, stats: {}, maxHp: 100, spell: { id: 'z' } }] as any
    render(<TeamSynergyBar team={noLevel} synergies={[{ synergy: { id: 'q', name: 'Astuzia' }, memberIds: ['c'] }] as any} />)
    expect(screen.getByText('Hermione')).toBeInTheDocument()
    expect(screen.getByText(/Lv\.?\s*1/i)).toBeInTheDocument()
    expect(screen.getByText(/Astuzia/)).toBeInTheDocument()
  })

  it('vertical row: expands the spell selector and wires a pool click to onSetSpell(wizardId, spellId)', () => {
    const spy = vi.fn()
    render(
      <TeamSynergyBar team={[memberWithPool]} synergies={[]} orientation="vertical" onSetSpell={spy} />,
    )

    // Role icon renders (RoleIcon sets aria-label to the role name) — smoke check
    // that the folded-in role-icon path from the old LoadoutPanel still renders.
    expect(screen.getByLabelText('Attaccante')).toBeInTheDocument()

    // Current spell name shows on the collapsed row's toggle button.
    const toggle = screen.getByRole('button', { name: /Expelliarmus/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')

    // Expand the collapsible pool.
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')

    // Click the non-active pool spell.
    const stupeficiumBtn = screen.getByRole('button', { name: 'Stupeficium' })
    fireEvent.click(stupeficiumBtn)

    expect(spy).toHaveBeenCalledWith('harry', 'stupeficium')
  })
})
