import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SynergyRibbon } from '@/components/battle/SynergyRibbon'
import type { ActiveSynergy } from '@/types'

const syn = (id: string, name: string, bonus: ActiveSynergy['synergy']['bonus']): ActiveSynergy => ({
  synergy: { id, name, kind: 'house', requires: {}, bonus }, memberIds: ['a', 'b', 'c'],
})

describe('SynergyRibbon', () => {
  it('shows each active synergy name and its bonus text', () => {
    render(<SynergyRibbon synergies={[syn('gryffindor3', 'Grifondoro', { def: 20 })]} />)
    const ribbon = screen.getByTestId('synergy-ribbon')
    expect(ribbon.querySelector('[data-synergy="gryffindor3"]')).not.toBeNull()
    expect(ribbon).toHaveTextContent('Grifondoro')
    expect(ribbon).toHaveTextContent(/\+20 DIF/)
  })
  it('shows player relics when provided', () => {
    const relics = [{ relic: { id: 'r1', name: 'Pietra', icon: 'Gem' } as never, stageObtained: 1 }]
    render(<SynergyRibbon synergies={[]} relics={relics} />)
    const ribbon = screen.getByTestId('synergy-ribbon')
    expect(ribbon.querySelector('[data-relic]')).not.toBeNull()
    expect(ribbon).toHaveTextContent('Pietra')
  })
  it('renders nothing when there are no synergies and no relics', () => {
    const { container } = render(<SynergyRibbon synergies={[]} />)
    expect(container.querySelector('[data-testid="synergy-ribbon"]')).toBeNull()
  })
})
