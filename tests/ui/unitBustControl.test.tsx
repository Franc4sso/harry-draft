import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { UnitBust } from '@/components/battle/UnitBust'
import type { ReplayUnit } from '@/game/engine/combat/replay'
import type { ActiveEffect } from '@/types'

const unit = {
  key: 'left:x', id: 'x', name: 'X', side: 'left', house: 'Grifondoro', role: 'Tank', tier: 3,
  maxHp: 100, atk: 10, def: 10, spd: 10, baseAtk: 10, baseDef: 10, baseSpd: 10,
  spell: { id: 's', name: 'S', cooldown: 0 },
} as unknown as ReplayUnit

it('renders a freeze glyph + strip when frozen', () => {
  const eff = { kind: 'freeze', statusId: 'freeze', remaining: 2 } as unknown as ActiveEffect
  const { container } = render(<UnitBust unit={unit} hp={100} effects={[eff]} />)
  expect(container.querySelector('[data-control-glyph="freeze"]')).toBeTruthy()
  expect(container.querySelector('[data-control-strip]')).toBeTruthy()
})

it('renders no control glyph/strip when only a buff is active', () => {
  const eff = { kind: 'buff', statusId: 'atkUp', remaining: 2, stat: 'atk', amount: 20 } as unknown as ActiveEffect
  const { container } = render(<UnitBust unit={unit} hp={100} effects={[eff]} />)
  expect(container.querySelector('[data-control-glyph]')).toBeNull()
  expect(container.querySelector('[data-control-strip]')).toBeNull()
})
