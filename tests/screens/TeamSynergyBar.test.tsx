import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
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

  it('vertical row: shows the equipped spell with no swap selector (one wizard, one spell)', () => {
    render(<TeamSynergyBar team={[memberWithPool]} synergies={[]} orientation="vertical" />)

    // The role now reads as a text label on the compact row.
    expect(screen.getByText('Attaccante')).toBeInTheDocument()

    // The equipped spell is shown directly — no toggle/expand needed.
    expect(screen.getByText('Expelliarmus')).toBeInTheDocument()

    // No spell-swap selector: no pool group, and the alternative pool spell never renders.
    expect(screen.queryByRole('group', { name: /Incantesimi di/ })).not.toBeInTheDocument()
    expect(screen.queryByText('Stupeficium')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
