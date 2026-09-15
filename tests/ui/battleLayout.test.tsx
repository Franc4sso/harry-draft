import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BattleArena } from '@/components/battle/BattleArena'
import type { Replay } from '@/game/engine/combat/replay'

// Minimal replay with one unit per side.
const replay = {
  units: [
    { key: 'left:a', id: 'a', name: 'A', side: 'left', house: 'Grifondoro', role: 'Tank', tier: 3, maxHp: 100, atk: 10, def: 10, spd: 10, baseAtk: 10, baseDef: 10, baseSpd: 10, spell: { id: 's', name: 'S', cooldown: 0 } },
    { key: 'right:b', id: 'b', name: 'B', side: 'right', house: 'Serpeverde', role: 'Attaccante', tier: 3, maxHp: 100, atk: 10, def: 10, spd: 10, baseAtk: 10, baseDef: 10, baseSpd: 10, spell: { id: 's', name: 'S', cooldown: 0 } },
  ],
  frames: [{ statusEffects: {}, cooldowns: {} }],
} as unknown as Replay

// Task 10 (Battaglia A — "campo contro campo") deliberately flips this from the
// earlier "Arena Row Inversion" redesign: the brief's chosen mockup puts the
// ENEMY row visually on top and the player's team below, facing each other —
// so enemies now come FIRST in document order (no flex-direction reversal is
// used, the DOM order IS the visual order). Updated, not deleted, per task 10's
// instructions.
it('enemies row sits above the player row in the DOM (campo contro campo)', () => {
  render(<BattleArena replay={replay} hp={{ 'left:a': 100, 'right:b': 100 }} entry={null} />)
  const player = screen.getByTestId('row-player')
  const enemies = screen.getByTestId('row-enemies')
  // enemies appear before player in document order
  expect(enemies.compareDocumentPosition(player) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

it('renders the center node between the rows', () => {
  render(<BattleArena replay={replay} hp={{ 'left:a': 100, 'right:b': 100 }} entry={null} center={<div data-testid="center-slot">X</div>} />)
  expect(screen.getByTestId('center-slot')).toBeInTheDocument()
})
