import { it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { UnitBust } from '@/components/battle/UnitBust'
import type { ReplayUnit } from '@/game/engine/combat/replay'

const unit = {
  key: 'left:x', id: 'x', name: 'X', side: 'left', house: 'Grifondoro', role: 'Tank', tier: 3,
  maxHp: 100, atk: 10, def: 10, spd: 10, baseAtk: 10, baseDef: 10, baseSpd: 10,
  spell: { id: 's', name: 'S', cooldown: 0 },
} as unknown as ReplayUnit

it('shows an impact pulse when targeted', () => {
  const { container } = render(<UnitBust unit={unit} hp={70} targeted float={{ text: '30', tone: 'damage' }} floatKey={1} />)
  expect(container.querySelector('[data-impact]')).toBeTruthy()
})
it('shows no impact pulse when not targeted', () => {
  const { container } = render(<UnitBust unit={unit} hp={100} />)
  expect(container.querySelector('[data-impact]')).toBeNull()
})
