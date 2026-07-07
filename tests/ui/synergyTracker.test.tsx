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
  it('groups a family into one track and marks reached tier nodes', () => {
    // 2 Grifondoro → tier-2 node reached (active), tier-3 and tier-4 nodes not reached.
    const team = [dw('a', 'Grifondoro', 'Attaccante'), dw('b', 'Grifondoro', 'Tank')]
    const { container } = render(<SynergyTracker rows={synergyProgress(team)} />)
    // One family header (name-only, count stripped)
    expect(screen.getByText('Grifondoro')).toBeInTheDocument()
    expect(screen.queryByText('2 Grifondoro')).toBeNull()
    // tier-2 node is active; tier-3 node exists but is not active
    expect(container.querySelector('[data-synergy="gryffindor2"][data-active]')).toBeTruthy()
    expect(container.querySelector('[data-synergy="gryffindor3"]:not([data-active])')).toBeTruthy()
  })

  it('marks lower active tiers superseded when a higher tier of the same family is active', () => {
    const team = [
      dw('a', 'Grifondoro', 'Attaccante'), dw('b', 'Grifondoro', 'Tank'),
      dw('c', 'Grifondoro', 'Supporto'), dw('d', 'Grifondoro', 'Controllo'),
    ]
    const { container } = render(<SynergyTracker rows={synergyProgress(team)} />)
    expect(container.querySelector('[data-synergy="gryffindor4"][data-active]:not([data-superseded])')).toBeTruthy()
    expect(container.querySelector('[data-synergy="gryffindor2"][data-superseded]')).toBeTruthy()
    expect(container.querySelector('[data-synergy="gryffindor3"][data-superseded]')).toBeTruthy()
  })

  it('in preview mode marks the node that would activate', () => {
    const team = [dw('a', 'Grifondoro', 'Attaccante'), dw('b', 'Grifondoro', 'Tank')]
    const cand = dw('c', 'Grifondoro', 'Supporto')
    const { container } = render(<SynergyTracker rows={previewSynergies(team, cand)} candidateName="c" />)
    expect(screen.getByText(/Se peschi/)).toBeInTheDocument()
    // tier-3 is the node that willActivate (count 2 → nextCount 3, threshold 3)
    expect(container.querySelector('[data-synergy="gryffindor3"][data-activates]')).toBeTruthy()
  })
})
