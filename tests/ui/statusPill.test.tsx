import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { UnitBust } from '@/components/battle/UnitBust'
import type { ReplayUnit } from '@/game/engine/combat/replay'
import type { ActiveEffect } from '@/types'

const unit = {
  key: 'left:x', id: 'x', name: 'X', side: 'left', house: 'Grifondoro', role: 'Attaccante', tier: 3,
  maxHp: 100, atk: 40, def: 20, spd: 30, baseAtk: 40, baseDef: 20, baseSpd: 30,
  spell: { id: 's', name: 'Incantesimo', cooldown: 0 },
} as unknown as ReplayUnit

// Buff/debuff now render a status pill (stat name + magnitude) IN ADDITION to the live
// stat bar, so the player can read the modifier and its duration — e.g. a weaken.
it('weaken (debuff) renders a status pill with the stat name', () => {
  const eff = { kind: 'debuff', statusId: 'weaken2', remaining: 2, stat: 'atk', amount: 25 } as unknown as ActiveEffect
  const { container } = render(<UnitBust unit={unit} hp={100} effects={[eff]} />)
  const pill = container.querySelector('[data-status-kind="debuff"]')
  expect(pill).not.toBeNull()
  expect(pill?.textContent).toMatch(/atk/i)
})
