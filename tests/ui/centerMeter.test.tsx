import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { CenterMeter } from '@/components/battle/CenterMeter'
import type { ReplayFrame, ReplayUnit } from '@/game/engine/combat/replay'
import { unitKey } from '@/game/engine/combat/replay'
import type { ActiveEffect } from '@/types'

const ru = (side: 'left' | 'right', id: string, maxHp = 100): ReplayUnit =>
  ({ key: unitKey(side, id), side, id, name: id, maxHp } as ReplayUnit)
const venom = (stacks: number): ActiveEffect =>
  ({ kind: 'dot', statusId: 'veleno', remaining: 2, stacks } as ActiveEffect)
const frame = (hp: Record<string, number>, se: Record<string, ActiveEffect[]> = {}): ReplayFrame =>
  ({ index: 1, entry: null, hp, cooldowns: {}, statusEffects: se })

describe('CenterMeter', () => {
  it('modalità economia quando nessun nemico è avvelenato', () => {
    const units = [ru('left', 'p1'), ru('left', 'p2'), ru('right', 'e1')]
    const f = frame({ 'left:p1': 80, 'left:p2': 60, 'right:e1': 40 })
    const { getByTestId } = render(<CenterMeter frame={f} units={units} playerSide="left" />)
    const el = getByTestId('center-meter')
    expect(el).toHaveAttribute('data-mode', 'economy')
    expect(el).toHaveAttribute('data-advantage', 'player') // 2 vivi vs 1
  })

  it('modalità veleno quando un nemico vivo è avvelenato', () => {
    const units = [ru('left', 'p1'), ru('right', 'e1', 800)]
    const f = frame({ 'left:p1': 80, 'right:e1': 400 }, { 'right:e1': [venom(6)] })
    const { getByTestId } = render(<CenterMeter frame={f} units={units} playerSide="left" />)
    const el = getByTestId('center-meter')
    expect(el).toHaveAttribute('data-mode', 'venom')
    expect(el).toHaveTextContent(/e1/)          // nome nemico agganciato
    expect(el).toHaveTextContent(/48/)          // danno/turno: 4*6 + 6*0.005*800 = 48
  })

  it('non mostra "muore" se il danno veleno per turno è 0 (nessun veleno → economia)', () => {
    const units = [ru('left', 'p1'), ru('right', 'e1')]
    const f = frame({ 'left:p1': 80, 'right:e1': 40 })
    const { getByTestId } = render(<CenterMeter frame={f} units={units} playerSide="left" />)
    expect(getByTestId('center-meter')).toHaveAttribute('data-mode', 'economy')
  })
})
