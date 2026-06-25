import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RelicChoiceScreen } from '@/components/screens/RelicChoiceScreen'
import { RELICS } from '@/data/relics'
import { detectSynergies } from '@/game/engine/synergy'
import type { DraftedWizard } from '@/types'

const choices = RELICS.slice(0, 3)

function makeGrifondoro(id: string): DraftedWizard {
  return {
    wizard: { id, name: id, house: 'Grifondoro', role: 'Attaccante' },
    stats: { hp: 100, atk: 20, def: 10, spd: 10 },
    maxHp: 100,
    spell: { id: 'test', name: 'Test', type: 'Attacco', effects: [] } as any,
  } as DraftedWizard
}

describe('RelicChoiceScreen', () => {
  it('renders the title and all three choices', () => {
    render(<RelicChoiceScreen choices={choices} owned={[]} team={[]} synergies={[]} onChoose={() => {}} />)
    expect(screen.getByText(/scegli una reliquia/i)).toBeInTheDocument()
    for (const c of choices) expect(screen.getByText(c.name)).toBeInTheDocument()
  })
  it('calls onChoose with the clicked relic', async () => {
    const onChoose = vi.fn()
    render(<RelicChoiceScreen choices={choices} owned={[]} team={[]} synergies={[]} onChoose={onChoose} />)
    await userEvent.click(screen.getByText(choices[1]!.name))
    expect(onChoose).toHaveBeenCalledWith(choices[1])
  })
  it('shows the squad and active synergies while choosing', () => {
    const team = [makeGrifondoro('g1'), makeGrifondoro('g2'), makeGrifondoro('g3')]
    const synergies = detectSynergies(team)
    render(<RelicChoiceScreen choices={choices} owned={[]} team={team} synergies={synergies} onChoose={() => {}} />)
    expect(screen.getByTestId('relic-squad')).toBeInTheDocument()
    expect(screen.getByTestId('relic-synergies')).toBeInTheDocument()
  })
})
