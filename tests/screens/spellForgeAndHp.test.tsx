import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import type { DraftedWizard, RunNode } from '@/types'
import { SPELL_BY_ID } from '@/data/spells'
import { SpellForgeScreen } from '@/components/screens/SpellForgeScreen'
import { TeamSynergyBar } from '@/components/run/TeamSynergyBar'
import { MapScreen } from '@/components/screens/MapScreen'
import { SPELL_LEVEL_MAX } from '@/game/engine/spellForge'

function dw(id: string, spellId: string, over: Partial<DraftedWizard> = {}): DraftedWizard {
  return {
    wizard: { id, name: id, house: 'Grifondoro', role: 'Attaccante', spellPool: [spellId] } as never,
    stats: { hp: 100, atk: 50, def: 10, spd: 10 },
    maxHp: 100,
    spell: SPELL_BY_ID[spellId]!,
    ...over,
  }
}

describe('SpellForgeScreen', () => {
  it('lists each wizard with their magic level and upgrades the picked one', () => {
    const onUpgrade = vi.fn()
    const team = [dw('Harry', 'expelliarmus'), dw('Ron', 'base_attack', { spellLevel: 2 })]
    render(<SpellForgeScreen team={team} onUpgrade={onUpgrade} />)

    expect(screen.getByTestId('forge-Harry')).toBeInTheDocument()
    expect(screen.getByTestId('forge-Ron')).toBeInTheDocument()
    // Ron already at Lv.2 → the card reflects the higher level.
    expect(within(screen.getByTestId('forge-Ron')).getByText(/Magia Lv\. 2/)).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('forge-Harry'))
    fireEvent.click(screen.getByRole('button', { name: /Incanta/i }))
    expect(onUpgrade).toHaveBeenCalledWith('Harry')
  })

  it('shows a concrete boost for spells whose power is NOT plain damage/heal', () => {
    // Regression: shields, statusId buffs, pure control, ward and revive used to render
    // "Nessun bonus diretto" — the exact "no buff" the player reported. Each must now show
    // a real boost line.
    const onUpgrade = vi.fn()
    const team = [
      dw('Alba', 'aegis'),      // shield magnitude
      dw('Bruno', 'salvio'),    // statusId spdUp buff
      dw('Ciro', 'imperio'),    // pure control (duration breakpoint)
      dw('Dora', 'rennervate'), // revive fraction
    ]
    render(<SpellForgeScreen team={team} onUpgrade={onUpgrade} />)

    for (const id of ['Alba', 'Bruno', 'Ciro', 'Dora']) {
      const card = within(screen.getByTestId(`forge-${id}`))
      expect(card.queryByText(/Nessun bonus diretto/)).toBeNull()
    }
    expect(within(screen.getByTestId('forge-Alba')).getByText(/Scudo/)).toBeInTheDocument()
    expect(within(screen.getByTestId('forge-Dora')).getByText(/Rianima/)).toBeInTheDocument()
    // Control gains at a breakpoint, so its preview points to the level where it lands.
    expect(within(screen.getByTestId('forge-Ciro')).getByText(/Durata/)).toBeInTheDocument()
  })

  it('disables a maxed wizard and still lets the player leave', () => {
    const onUpgrade = vi.fn()
    const team = [dw('Cap', 'expelliarmus', { spellLevel: SPELL_LEVEL_MAX })]
    render(<SpellForgeScreen team={team} onUpgrade={onUpgrade} />)
    expect(within(screen.getByTestId('forge-Cap')).getByText(/MAX/)).toBeInTheDocument()
    // No upgradable wizard → the button reads "Prosegui" and is enabled to leave the node.
    const btn = screen.getByRole('button', { name: /Prosegui/i })
    expect(btn).toBeEnabled()
    fireEvent.click(btn)
    expect(onUpgrade).toHaveBeenCalledWith('Cap')
  })
})

describe('TeamSynergyBar — HP visible in the map sidebar', () => {
  it('renders each wizard current/max HP in the vertical sidebar', () => {
    const team = [dw('Harry', 'expelliarmus', { currentHp: 40, maxHp: 100 })]
    render(<TeamSynergyBar team={team} orientation="vertical" />)
    expect(screen.getByText('40/100')).toBeInTheDocument()
  })

  it('shows K.O. for a fallen wizard', () => {
    const team = [dw('Harry', 'expelliarmus', { currentHp: 0, maxHp: 100 })]
    render(<TeamSynergyBar team={team} orientation="vertical" />)
    expect(screen.getByText('K.O.')).toBeInTheDocument()
  })
})

describe('MapScreen — elite enemy-roster preview', () => {
  it('renders the enemy briefing for a combat node from node.battle', () => {
    const enemy = dw('Malfoy', 'expelliarmus', { maxHp: 88 })
    const map: RunNode[] = [
      { id: 'a0f0n0', type: 'battle', next: ['a0f1n0'] },
      {
        id: 'a0f1n0', type: 'elite', next: [],
        battle: { enemyTeam: [enemy], enemyRelics: [], enemyLevel: 4 },
        preview: { synergyIds: [] },
      },
    ]
    render(<MapScreen map={map} currentNodeId="a0f0n0" reachableIds={['a0f1n0']} onChoose={() => {}} area={0} areasTotal={3} />)
    const card = screen.getByTestId('enemy-preview-a0f1n0')
    expect(within(card).getByText('Malfoy')).toBeInTheDocument()
    expect(within(card).getByText(/Lv 4/)).toBeInTheDocument()
    expect(within(card).getByText('88')).toBeInTheDocument()
    // Role counter cycle removed: the preview no longer claims a "forte vs" advantage.
    expect(within(card).queryByText(/forte vs/)).not.toBeInTheDocument()
  })

  it('shows the boss portrait (not the crown emoji) when the preview carries a bossFace', () => {
    const boss = dw('voldemort', 'avada', { maxHp: 200 })
    const map: RunNode[] = [
      { id: 'a0f0n0', type: 'battle', next: ['a0f1n0'] },
      {
        id: 'a0f1n0', type: 'boss', next: [],
        battle: { enemyTeam: [boss], enemyRelics: [], enemyLevel: 10 },
        preview: { synergyIds: [], bossName: 'Lord Voldemort', bossFace: { id: 'voldemort', house: 'Serpeverde' } },
      },
    ]
    const { container } = render(
      <MapScreen map={map} currentNodeId="a0f0n0" reachableIds={['a0f1n0']} onChoose={() => {}} area={2} areasTotal={3} />,
    )
    const seal = screen.getByTestId('node-a0f1n0')
    expect(seal.querySelector('img[src="/portraits/voldemort.webp"]')).toBeTruthy()
    expect(seal.textContent).not.toContain('👑')
  })

  it('renders no preview for a non-combat node with no battle package', () => {
    const map: RunNode[] = [
      { id: 'a0f0n0', type: 'battle', next: ['a0f1n0'] },
      { id: 'a0f1n0', type: 'spellForge', next: [] },
    ]
    render(<MapScreen map={map} currentNodeId="a0f0n0" reachableIds={['a0f1n0']} onChoose={() => {}} area={0} areasTotal={3} />)
    expect(screen.queryByTestId('enemy-preview-a0f1n0')).toBeNull()
  })
})
