import { it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { UnitBust } from '@/components/battle/UnitBust'
import type { ReplayUnit } from '@/game/engine/combat/replay'
import type { ActiveEffect } from '@/types'

const unit = {
  key: 'left:x', id: 'x', name: 'X', side: 'left', house: 'Grifondoro', role: 'Attaccante', tier: 3,
  maxHp: 100, atk: 10, def: 10, spd: 10, baseAtk: 10, baseDef: 10, baseSpd: 10,
  spell: { id: 's', name: 'S', cooldown: 0 },
} as unknown as ReplayUnit

it('does not throw on an impact shake (spring + multi-keyframe guard)', () => {
  // A crit impact uses a multi-keyframe x array; the transition must not be a spring for x.
  expect(() =>
    render(<UnitBust unit={unit} hp={70} targeted float={{ text: '48', tone: 'crit' }} floatKey={1} />),
  ).not.toThrow()
})

it('does NOT render a pill for a buff or debuff effect', () => {
  const buff = { kind: 'buff', statusId: 'atkUp', remaining: 2, stat: 'atk', amount: 10 } as unknown as ActiveEffect
  const { container } = render(<UnitBust unit={unit} hp={100} effects={[buff]} />)
  expect(container.querySelector('[data-status-kind="buff"]')).toBeNull()
})

it('DOES render a pill for a control/dot effect', () => {
  const dot = { kind: 'dot', statusId: 'burn', remaining: 2, amount: 8 } as unknown as ActiveEffect
  const { container } = render(<UnitBust unit={unit} hp={100} effects={[dot]} />)
  expect(container.querySelector('[data-status-kind="dot"]')).toBeTruthy()
})

it('renders the role badge over the portrait (top area, with data-role-badge)', () => {
  const { container } = render(<UnitBust unit={unit} hp={100} />)
  const badge = container.querySelector('[data-role-badge]') as HTMLElement
  expect(badge).toBeTruthy()
  expect(badge.className).toMatch(/top-/) // positioned at the top over the portrait, not bottom-14
})
