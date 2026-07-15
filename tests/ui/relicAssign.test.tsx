import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RelicNodeScreen } from '@/components/screens/RelicNodeScreen'
import type { Relic, DraftedWizard } from '@/types'
import { WIZARDS } from '@/data/wizards'
import { SPELL_BY_ID } from '@/data/spells'

const marchio: Relic = { id: 'marchio-nero', name: 'Marchio Nero', desc: 'oscuro', rarity: 'rara', keywords: ['magieOscure'], assignable: true, grantsDarkMagic: { bonus: 0.5, recoil: 0.2 } }
const plain: Relic = { id: 'giratempo', name: 'Giratempo', desc: 'x', rarity: 'rara' }
const team: DraftedWizard[] = ['voldemort', 'snape'].map(id => ({ wizard: WIZARDS.find(w => w.id === id)!, stats: { hp: 100, atk: 10, def: 10, spd: 10 }, maxHp: 100, spell: SPELL_BY_ID['base_attack']! }))

describe('RelicNodeScreen Marchio assignment', () => {
  it('picking an assignable relic requires choosing a carrier, then onPick gets (id, carrier)', () => {
    const onPick = vi.fn()
    render(<RelicNodeScreen offer={[marchio]} owned={[]} team={team} onPick={onPick} />)
    fireEvent.click(screen.getByTestId('relic-marchio-nero'))
    // carrier step appears
    fireEvent.click(screen.getByTestId('assign-carrier-voldemort'))
    fireEvent.click(screen.getByRole('button', { name: /prendi/i }))
    expect(onPick).toHaveBeenCalledWith('marchio-nero', 'voldemort')
  })
  it('a normal relic does not show the carrier step; onPick gets just the id', () => {
    const onPick = vi.fn()
    render(<RelicNodeScreen offer={[plain]} owned={[]} team={team} onPick={onPick} />)
    fireEvent.click(screen.getByTestId('relic-giratempo'))
    fireEvent.click(screen.getByRole('button', { name: /prendi/i }))
    expect(onPick).toHaveBeenCalledWith('giratempo', undefined)
  })

  it('assigning a grantsDarkMagic relic shows the corruption warning BEFORE confirming', () => {
    const onPick = vi.fn()
    render(<RelicNodeScreen offer={[marchio]} owned={[]} team={team} onPick={onPick} />)
    fireEvent.click(screen.getByTestId('relic-marchio-nero'))
    fireEvent.click(screen.getByTestId('assign-carrier-voldemort'))
    expect(screen.getByText(/Diventerà Corrotto/i)).toBeInTheDocument()
    expect(screen.getByText(/per sempre, non curabile/i)).toBeInTheDocument()
  })

  it('a normal assignable relic (no grantsDarkMagic) does NOT show the corruption warning', () => {
    const nonCorrupting: Relic = { id: 'giratempo-portatile', name: 'Giratempo Portatile', desc: 'x', rarity: 'rara', assignable: true }
    const onPick = vi.fn()
    render(<RelicNodeScreen offer={[nonCorrupting]} owned={[]} team={team} onPick={onPick} />)
    fireEvent.click(screen.getByTestId('relic-giratempo-portatile'))
    fireEvent.click(screen.getByTestId('assign-carrier-voldemort'))
    expect(screen.queryByText(/Diventerà Corrotto/i)).toBeNull()
  })
})
