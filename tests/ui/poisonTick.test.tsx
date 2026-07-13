import { it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { floatFor } from '@/components/battle/damageFloat'
import { UnitBust } from '@/components/battle/UnitBust'
import type { ReplayUnit } from '@/game/engine/combat/replay'

it('un tick veleno ha tono dot (non damage)', () => {
  const f = floatFor({ turn: 1, action: 'Veleno', type: 'Controllo', value: 9, flags: ['dot'], actorId: 'a', targetId: 'b' } as any)
  expect(f).toEqual({ text: '-9', tone: 'dot' })
})

it('un colpo normale resta tono damage', () => {
  const f = floatFor({ turn: 1, action: 'Colpo', type: 'Attacco', value: 12, flags: [], actorId: 'a', targetId: 'b' } as any)
  expect(f?.tone).toBe('damage')
})

const unit = {
  key: 'left:x', id: 'x', name: 'X', side: 'left', house: 'Grifondoro', role: 'Tank', tier: 3,
  maxHp: 100, atk: 10, def: 10, spd: 10, baseAtk: 10, baseDef: 10, baseSpd: 10,
  spell: { id: 's', name: 'S', cooldown: 0 },
} as unknown as ReplayUnit

it('un tick veleno mostra il flash verde (dot), non rosso da attacco', () => {
  const { container } = render(
    <UnitBust unit={unit} hp={70} targeted float={{ text: '-9', tone: 'dot' }} floatKey={1} />,
  )
  const flash = container.querySelector('[data-impact]')
  expect(flash?.getAttribute('data-impact')).toBe('dot')
})
