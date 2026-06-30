import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SynergyTracker } from '@/components/draft/SynergyTracker'
import { synergyProgress, previewSynergies } from '@/game/engine/synergy'
import type { DraftedWizard, Wizard } from '@/types'

function dw(id: string, house: Wizard['house'], role: Wizard['role']): DraftedWizard {
  return {
    wizard: { id, name: id, house, role, tier: 3, ranges: { hp:[80,80],atk:[10,10],def:[10,10],spd:[10,10] }, spellPool:['x'], tags: [] },
    stats: { hp:80,atk:10,def:10,spd:10 }, maxHp:80, spell: { id:'x',name:'X',type:'Attacco',hitChance:1 },
  } as unknown as DraftedWizard
}

describe('SynergyTracker', () => {
  it('shows current synergies with count/threshold and bonus text', () => {
    const team = [dw('a','Grifondoro','Attaccante'), dw('b','Grifondoro','Tank')]
    render(<SynergyTracker rows={synergyProgress(team)} />)
    // The tracker strips the leading count from the synergy name ("2 Grifondoro" → "Grifondoro"),
    // matching the name-only convention used by the draft chips.
    // With 3 tiers, all three Grifondoro rows (2/3/4) appear since count=2>0 for each.
    const grifRows = screen.getAllByText('Grifondoro')
    expect(grifRows).toHaveLength(3)
    expect(screen.queryByText('3 Grifondoro')).toBeNull()
    // gryffindor2 is active (count=2, threshold=2) → shows "2 / 2"
    expect(screen.getByText(/2\s*\/\s*2/)).toBeInTheDocument()
    // gryffindor3 is visible and in-progress (count=2, threshold=3) → shows "2 / 3"
    // (no bonus text: gryffindor mechanic moved to houseEffects, bonus: {})
    expect(screen.getByText(/2\s*\/\s*3/)).toBeInTheDocument()
  })
  it('marks lower active tiers as superseded when a higher tier of the same family is active', () => {
    // 4 Grifondoro → tier-4 active; tiers 2 and 3 are active-by-count but superseded
    // (combat applies only the highest tier per family). The tracker must reflect that.
    const team = [
      dw('a', 'Grifondoro', 'Attaccante'), dw('b', 'Grifondoro', 'Tank'),
      dw('c', 'Grifondoro', 'Supporto'), dw('d', 'Grifondoro', 'Controllo'),
    ]
    const { container } = render(<SynergyTracker rows={synergyProgress(team)} />)
    // gryffindor4 is the live tier — NOT superseded
    expect(container.querySelector('[data-synergy="gryffindor4"]:not([data-superseded])')).toBeTruthy()
    // gryffindor2 and gryffindor3 are active-by-count but superseded by tier 4
    expect(container.querySelector('[data-synergy="gryffindor2"][data-superseded]')).toBeTruthy()
    expect(container.querySelector('[data-synergy="gryffindor3"][data-superseded]')).toBeTruthy()
  })
  it('in preview mode shows the projection and the activating row', () => {
    const team = [dw('a','Grifondoro','Attaccante'), dw('b','Grifondoro','Tank')]
    const cand = dw('c','Grifondoro','Supporto')
    const { container } = render(<SynergyTracker rows={previewSynergies(team, cand)} candidateName="c" />)
    expect(screen.getByText(/Se peschi/)).toBeInTheDocument()
    // Multiple rows show "2 → 3" (gryffindor2, gryffindor3, gryffindor4 all have count=2 and nextCount=3)
    expect(screen.getAllByText(/2\s*→\s*3/).length).toBeGreaterThanOrEqual(1)
    // gryffindor3 is the row that willActivate (count=2 < threshold=3, nextCount=3 >= threshold=3)
    expect(container.querySelector('[data-synergy="gryffindor3"][data-activates]')).toBeTruthy()
  })
})
