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

// 2026-09-16 (Task 3, "il palco"): Task 10's "campo contro campo" two-row layout
// (`row-enemies` above `row-player`, mirrored WizardCard rows) is gone — replaced by the
// mockup's stage, with enemy miniatures in a LEFT column and ally miniatures in a RIGHT
// column (mirroring "La corsia del tempo" v11: NEMICI at x18, I TUOI at x1264 — enemies
// on the reader's left, allies on the right, same relative order as before: enemies come
// first). `col-enemies`/`col-allies` are those two columns' new test ids.
it('enemies sit in the left column, allies in the right column, in document order', () => {
  render(<BattleArena replay={replay} hp={{ 'left:a': 100, 'right:b': 100 }} entry={null} />)
  const allies = screen.getByTestId('col-allies')
  const enemies = screen.getByTestId('col-enemies')
  // enemies appear before allies in document order
  expect(enemies.compareDocumentPosition(allies) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

it('renders the center node inside the stage', () => {
  render(<BattleArena replay={replay} hp={{ 'left:a': 100, 'right:b': 100 }} entry={null} center={<div data-testid="center-slot">X</div>} />)
  expect(screen.getByTestId('center-slot')).toBeInTheDocument()
})
