import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SynergyGraph } from '@/components/screens/compendium/SynergyGraph'
import { SYNERGIES } from '@/data/synergies'
import { synergyBonusText } from '@/lib/glossary'

describe('SynergyGraph', () => {
  it('renders a node for every synergy', () => {
    render(<SynergyGraph />)
    for (const s of SYNERGIES) {
      expect(screen.getAllByText(s.name).length).toBeGreaterThan(0)
    }
  })
  it('reveals bonus text when a synergy is selected', async () => {
    render(<SynergyGraph />)
    const withBonus = SYNERGIES.find(s => synergyBonusText(s.bonus).length > 0)!
    await userEvent.click(screen.getAllByText(withBonus.name)[0]!)
    const bonus = synergyBonusText(withBonus.bonus)[0]!
    expect(screen.getByText(bonus)).toBeInTheDocument()
  })
})
