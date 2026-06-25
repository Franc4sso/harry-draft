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

it('enemies row sits above the player row in the DOM', () => {
  render(<BattleArena replay={replay} hp={{ 'left:a': 100, 'right:b': 100 }} entry={null} />)
  const enemies = screen.getByTestId('row-enemies')
  const player = screen.getByTestId('row-player')
  // enemies appears before player in document order
  expect(enemies.compareDocumentPosition(player) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})
