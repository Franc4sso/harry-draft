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

  it('ignores FALLEN wizards — a Duo whose 2nd signal contributor is dead is not active', () => {
    // Two Attaccante mages BOTH carrying veleno+esecuzione would light Cancrena — but one is
    // K.O. (currentHp 0). With only one living contributor neither signal reaches its >=2
    // threshold, so Cancrena must NOT show as active (it won't activate in the real battle).
    const withFallen = [
      { wizard: { id: 'live', name: 'Vivo', house: 'Grifondoro', role: 'Attaccante', tags: ['veleno', 'esecuzione'] }, level: 1, stats: {}, maxHp: 100, currentHp: 80 },
      { wizard: { id: 'dead', name: 'Morto', house: 'Grifondoro', role: 'Attaccante', tags: ['veleno', 'esecuzione'] }, level: 1, stats: {}, maxHp: 100, currentHp: 0 },
    ] as any
    const { container } = render(<DuoBar team={withFallen} relics={[]} />)
    // No active Cancrena card (a live pair would produce one).
    expect(container.querySelector('[data-duo="cancrena"][data-active]')).toBeNull()
    expect(screen.queryByText('Cancrena')).not.toBeInTheDocument()
  })
})
