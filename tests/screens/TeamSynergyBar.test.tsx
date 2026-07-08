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

    // The role now reads as a text label on the compact row.
    expect(screen.getByText('Attaccante')).toBeInTheDocument()

    // The whole row is the toggle (named by the wizard). Compact: the spell is
    // hidden until the row is expanded — not shown on the collapsed row.
    const toggle = screen.getByRole('button', { name: /Harry/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Expelliarmus')).not.toBeInTheDocument()

    // Expand the collapsible pool — the equipped spell + pool now appear.
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    // Equipped-spell label + the active pool button both read "Expelliarmus".
    expect(screen.getAllByText('Expelliarmus').length).toBeGreaterThan(0)

    // Click the non-active pool spell.
    const stupeficiumBtn = screen.getByRole('button', { name: 'Stupeficium' })
    fireEvent.click(stupeficiumBtn)

    expect(spy).toHaveBeenCalledWith('harry', 'stupeficium')
  })
})
