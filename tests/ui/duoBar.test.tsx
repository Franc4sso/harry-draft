import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DuoBar } from '@/components/run/DuoBar'

// Team lights MURO VIVENTE fully (scudirigen: 2 tagged mages, taunt: 1 Tank) and is one
// signal short of CANCRENA (veleno lit via the same 2 mages, esecuzione missing).
const team = [
  { wizard: { id: 'a', name: 'Tank', house: 'Grifondoro', role: 'Tank', tags: [] }, level: 1, stats: {}, maxHp: 100 },
  { wizard: { id: 'b', name: 'Att', house: 'Grifondoro', role: 'Attaccante', tags: ['scudirigen', 'veleno'] }, level: 1, stats: {}, maxHp: 100 },
  { wizard: { id: 'c', name: 'Sup', house: 'Grifondoro', role: 'Supporto', tags: ['scudirigen', 'veleno'] }, level: 1, stats: {}, maxHp: 100 },
] as any

describe('DuoBar', () => {
  it('renders the active Duo name and the near Duo missing-signal label', () => {
    render(<DuoBar team={team} relics={[]} />)
    // Active: Muro Vivente (scudirigen + taunt both lit)
    expect(screen.getByText('Muro Vivente')).toBeInTheDocument()
    // Near: Cancrena (veleno lit, esecuzione missing) shows the missing signal label.
    expect(screen.getByText(/manca: Esecuzione/)).toBeInTheDocument()
  })

  it('renders nothing when there is no active or near Duo', () => {
    const bare = [{ wizard: { id: 'z', name: 'Solo', house: 'Grifondoro', role: 'Attaccante', tags: [] }, level: 1, stats: {}, maxHp: 100 }] as any
    const { container } = render(<DuoBar team={bare} relics={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
