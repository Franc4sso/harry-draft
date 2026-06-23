import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { DraftedWizard } from '@/types'
import { SquadPanel } from '@/components/draft/SquadPanel'

const pick = {
  wizard: { id: 'harry', name: 'Harry', house: 'Grifondoro', role: 'Attaccante', tier: 1, ranges: { hp:[1,1],atk:[1,1],def:[1,1],spd:[1,1] }, spellPool:['x'], tags: [] },
  stats: { hp:1,atk:1,def:1,spd:1 }, maxHp:1, spell: { id:'x',name:'X',type:'Attacco',hitChance:1 },
} as unknown as DraftedWizard

describe('SquadPanel', () => {
  it('shows picked wizards and the remaining empty slots', () => {
    const { container } = render(<SquadPanel picks={[pick]} teamSize={5} />)
    expect(screen.getByText('Harry')).toBeInTheDocument()
    expect(container.querySelectorAll('[data-empty]')).toHaveLength(4)
  })
})
