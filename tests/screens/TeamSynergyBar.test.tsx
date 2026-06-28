import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TeamSynergyBar } from '@/components/run/TeamSynergyBar'

const team = [
  { wizard: { id: 'a', name: 'Harry', house: 'Grifondoro' }, level: 3, stats: {}, maxHp: 100, spell: { id: 'x' } },
  { wizard: { id: 'b', name: 'Ron', house: 'Grifondoro' }, level: 1, stats: {}, maxHp: 100, spell: { id: 'y' } },
] as any

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
})
