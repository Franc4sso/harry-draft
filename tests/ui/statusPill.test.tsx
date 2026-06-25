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

it('weaken pill shows percentage value', () => {
  const eff = { kind: 'debuff', statusId: 'weaken2', remaining: 2, stat: 'atk', amount: 25 } as unknown as ActiveEffect
  render(<UnitBust unit={unit} hp={100} effects={[eff]} />)
  const pill = screen.getByTitle(/Indebolimento atk -25%/)
  expect(pill.textContent).toContain('-25%')
})
