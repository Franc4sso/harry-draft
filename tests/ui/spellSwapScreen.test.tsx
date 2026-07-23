import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SpellSwapScreen } from '@/components/screens/SpellSwapScreen'
import type { DraftedWizard } from '@/types'

function makeTeam(): DraftedWizard[] {
  return [
    {
      wizard: { id: 'a', name: 'Ada', house: 'Grifondoro', role: 'Attaccante', tags: [] },
      level: 1, maxHp: 100, stats: { hp: 100, atk: 10, def: 10, spd: 10 },
      spell: { id: 'expelliarmus', name: 'Expelliarmus', type: 'Attacco', power: 1.4, hitChance: 0.95, cooldown: 0 },
      spellLevel: 1,
    },
    {
      wizard: { id: 'b', name: 'Beo', house: 'Grifondoro', role: 'Attaccante', tags: [] },
      level: 1, maxHp: 90, stats: { hp: 90, atk: 20, def: 5, spd: 12 },
      spell: { id: 'bombarda', name: 'Bombarda', type: 'Attacco', power: 2.0, hitChance: 0.85, cooldown: 1 },
      spellLevel: 1,
    },
  ] as any
}

const offers = ['stupeficium', 'reducto']

describe('SpellSwapScreen', () => {
  it('renders data-testid spellswap-screen with the team and both offered spells', () => {
    render(<SpellSwapScreen team={makeTeam()} offers={offers} onConfirm={vi.fn()} />)
    expect(screen.getByTestId('spellswap-screen')).not.toBeNull()
    for (const dw of makeTeam()) {
      expect(screen.getByTestId(`spellswap-wizard-${dw.wizard.id}`)).not.toBeNull()
    }
    for (const spellId of offers) {
      expect(screen.getByTestId(`spellswap-spell-${spellId}`)).not.toBeNull()
    }
  })

  it('non mostra alcun costo (lo swap e\' gratis)', () => {
    render(<SpellSwapScreen team={makeTeam()} offers={offers} onConfirm={vi.fn()} />)
    expect(screen.queryByText(/maxHP/i)).toBeNull()
    expect(screen.queryByText(/costo/i)).toBeNull()
    expect(screen.queryByTestId(/spellswap-cost/)).toBeNull()
  })

  it('la conferma e\' disabilitata finche\' non sono scelti sia mago che magia', () => {
    render(<SpellSwapScreen team={makeTeam()} offers={offers} onConfirm={vi.fn()} />)
    expect(screen.getByTestId('spellswap-confirm').hasAttribute('disabled')).toBe(true)
  })

  it('scegliere mago + magia e confermare invia {kind: spell-swap, wizardId, spellId}', () => {
    const onConfirm = vi.fn()
    render(<SpellSwapScreen team={makeTeam()} offers={offers} onConfirm={onConfirm} />)
    fireEvent.click(screen.getByTestId('spellswap-wizard-a'))
    fireEvent.click(screen.getByTestId('spellswap-spell-reducto'))
    fireEvent.click(screen.getByTestId('spellswap-confirm'))
    expect(onConfirm).toHaveBeenCalledWith('a', 'reducto')
  })
})
