import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { ActiveRelic, DraftedWizard } from '@/types'
import { RelicBar } from '@/components/relics/RelicBar'

const lacrime = {
  relic: {
    id: 'lacrime-fenice',
    name: 'Lacrime di Fenice',
    desc: 'Riporta in vita i maghi caduti.',
    rarity: 'epica',
    active: 'revive',
  },
} as unknown as ActiveRelic

const baseWizard = {
  wizard: {
    id: 'harry',
    name: 'Harry',
    house: 'Grifondoro',
    role: 'Attaccante',
    tier: 1,
    gender: 'm',
    ranges: { hp: [1, 1], atk: [1, 1], def: [1, 1], spd: [1, 1] },
    spellPool: ['expelliarmus'],
    tags: [],
  },
  stats: { hp: 10, atk: 5, def: 3, spd: 4 },
  maxHp: 10,
  spell: { id: 'expelliarmus', name: 'Expelliarmus', desc: 'Disarma.', type: 'Attacco', hitChance: 0.95 },
}

const deadWizard = { ...baseWizard, currentHp: 0 } as unknown as DraftedWizard
const aliveWizard = { ...baseWizard, currentHp: 10 } as unknown as DraftedWizard

describe('RelicBar — consumable "Usa" button', () => {
  it('shows an enabled Usa button when a wizard is dead, and fires onUse on click', () => {
    const spy = vi.fn()
    render(<RelicBar relics={[lacrime]} team={[deadWizard]} onUse={spy} />)

    const btn = screen.getByRole('button', { name: 'Usa' })
    expect(btn).not.toBeDisabled()

    fireEvent.click(btn)
    expect(spy).toHaveBeenCalledWith('lacrime-fenice')
  })

  it('shows a disabled Usa button when no wizard is dead, and does NOT fire onUse', () => {
    const spy = vi.fn()
    render(<RelicBar relics={[lacrime]} team={[aliveWizard]} onUse={spy} />)

    const btn = screen.getByRole('button', { name: 'Usa' })
    expect(btn).toBeDisabled()

    fireEvent.click(btn)
    expect(spy).not.toHaveBeenCalled()
  })

  it('does not render a Usa button when onUse is not provided', () => {
    render(<RelicBar relics={[lacrime]} />)
    expect(screen.queryByRole('button', { name: 'Usa' })).toBeNull()
  })

  // The relic tooltip lives in a narrow LEFT sidebar (RunBRunner map view); opening it
  // rightward (left-full) spilled over the map tree and got clipped. It must open downward.
  it('opens its tooltip downward, not rightward, so it stays inside the sidebar', () => {
    render(<RelicBar relics={[lacrime]} />)
    const tip = screen.getByRole('tooltip')
    expect(tip.className).toContain('top-full')
    expect(tip.className).not.toContain('left-full')
  })
})
