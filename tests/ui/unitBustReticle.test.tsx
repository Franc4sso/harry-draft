import { it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { UnitBust } from '@/components/battle/UnitBust'
import type { ReplayUnit } from '@/game/engine/combat/replay'

const unit = {
  key: 'left:x', id: 'x', name: 'X', side: 'left', house: 'Grifondoro', role: 'Tank', tier: 3,
  maxHp: 100, atk: 10, def: 10, spd: 10, baseAtk: 10, baseDef: 10, baseSpd: 10,
  spell: { id: 's', name: 'S', cooldown: 0 },
} as unknown as ReplayUnit

it('draws a targeting reticle on the chosen target', () => {
  const { container } = render(<UnitBust unit={unit} hp={100} targeted />)
  expect(container.querySelector('[data-testid="target-reticle"]')).toBeTruthy()
})

it('shows no reticle when the unit is not the target', () => {
  const { container } = render(<UnitBust unit={unit} hp={100} />)
  expect(container.querySelector('[data-testid="target-reticle"]')).toBeNull()
})

it('shows no reticle on a dead unit (the KO tombstone takes over)', () => {
  const { container } = render(<UnitBust unit={unit} hp={0} targeted />)
  expect(container.querySelector('[data-testid="target-reticle"]')).toBeNull()
})
