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
    expect(screen.getByText('3 Grifondoro')).toBeInTheDocument()
    expect(screen.getByText(/2\s*\/\s*3/)).toBeInTheDocument()
    expect(screen.getByText(/\+20 DIF/)).toBeInTheDocument()
  })
  it('in preview mode shows the projection and the activating row', () => {
    const team = [dw('a','Grifondoro','Attaccante'), dw('b','Grifondoro','Tank')]
    const cand = dw('c','Grifondoro','Supporto')
    const { container } = render(<SynergyTracker rows={previewSynergies(team, cand)} candidateName="c" />)
    expect(screen.getByText(/Se peschi/)).toBeInTheDocument()
    expect(screen.getByText(/2\s*→\s*3/)).toBeInTheDocument()
    expect(container.querySelector('[data-activates]')).toBeTruthy()
  })
})
