import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { DraftedWizard } from '@/types'
import { DraftCandidateCard } from '@/components/draft/DraftCandidateCard'

const harry = {
  wizard: { id: 'harry', name: 'Harry', house: 'Grifondoro', role: 'Attaccante', tier: 1,
    ranges: { hp: [110,135], atk: [22,38], def: [16,28], spd: [22,32] }, spellPool: ['x'], tags: ['order'] },
  stats: { hp: 120, atk: 30, def: 22, spd: 28 }, maxHp: 120,
  spell: { id: 'x', name: 'Expelliarmus', type: 'Controllo', hitChance: 1, desc: 'disarma' },
} as unknown as DraftedWizard

describe('DraftCandidateCard', () => {
  it('shows affiliation chips and marks hot ones', () => {
    const { container } = render(<DraftCandidateCard drafted={harry} hotSynergyIds={new Set(['gryffindor3'])} />)
    expect(screen.getByText('3 Grifondoro')).toBeInTheDocument()
    expect(container.querySelector('[data-hot][data-synergy="gryffindor3"]')).toBeTruthy()
    expect(container.querySelector('[data-hot][data-synergy="attackers3"]')).toBeFalsy()
  })
  it('fires onConsider on pointer enter and onPick on click', () => {
    const onConsider = vi.fn(); const onPick = vi.fn()
    const { container } = render(<DraftCandidateCard drafted={harry} onConsider={onConsider} onPick={onPick} />)
    fireEvent.pointerEnter(container.firstChild as Element)
    expect(onConsider).toHaveBeenCalled()
    fireEvent.click(screen.getByText('Harry'))
    expect(onPick).toHaveBeenCalled()
  })
})
