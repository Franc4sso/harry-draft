import { describe, it, expect } from 'vitest'
import { livingCount, venomOf, venomPerTurn, focusEnemy, turnsToDie } from '@/lib/combatReadout'
import type { ReplayFrame, ReplayUnit } from '@/game/engine/combat/replay'
import { unitKey } from '@/game/engine/combat/replay'
import type { ActiveEffect } from '@/types'

// minimal ReplayUnit factory
const ru = (side: 'left' | 'right', id: string, maxHp = 100): ReplayUnit =>
  ({ key: unitKey(side, id), side, id, name: id, maxHp } as ReplayUnit)

const venom = (stacks: number): ActiveEffect =>
  ({ kind: 'dot', statusId: 'veleno', remaining: 2, stacks } as ActiveEffect)

// frame factory: hp map + optional statusEffects + optional entry
const frame = (
  hp: Record<string, number>,
  statusEffects: Record<string, ActiveEffect[]> = {},
  entry: ReplayFrame['entry'] = null,
): ReplayFrame => ({ index: 1, entry, hp, cooldowns: {}, statusEffects })

describe('livingCount', () => {
  it('conta le unità con hp>0 sul side', () => {
    const units = [ru('right', 'a'), ru('right', 'b'), ru('left', 'p')]
    const f = frame({ 'right:a': 50, 'right:b': 0, 'left:p': 80 })
    expect(livingCount(f, units, 'right')).toBe(1) // b è morto
    expect(livingCount(f, units, 'left')).toBe(1)
  })
})

describe('venomOf', () => {
  it('ritorna gli stack veleno, 0 se assente', () => {
    const u = ru('right', 'a')
    const f = frame({ 'right:a': 50 }, { 'right:a': [venom(6)] })
    expect(venomOf(f, u)).toBe(6)
    const f0 = frame({ 'right:a': 50 }, {})
    expect(venomOf(f0, u)).toBe(0)
  })
})

describe('venomPerTurn', () => {
  it('applica 4*stacks + min(stacks,8)*0.005*maxHp arrotondato', () => {
    // 6 stack, maxHp 800: 4*6=24 + 6*0.005*800=24 → 48
    expect(venomPerTurn(6, 800)).toBe(48)
    // cap del termine pct a 8 stack: 10 stack, maxHp 800: 40 + 8*0.005*800=32 → 72
    expect(venomPerTurn(10, 800)).toBe(72)
    expect(venomPerTurn(0, 800)).toBe(0)
  })
})

describe('focusEnemy', () => {
  it('sceglie il nemico vivo più avvelenato (a parità, HP più basso)', () => {
    const units = [ru('right', 'a'), ru('right', 'b'), ru('left', 'p')]
    const f = frame(
      { 'right:a': 50, 'right:b': 30, 'left:p': 80 },
      { 'right:a': [venom(3)], 'right:b': [venom(3)] }, // parità stack → HP più basso = b
    )
    expect(focusEnemy(f, units, 'left')?.id).toBe('b')
  })
  it('ignora un nemico morto anche se avvelenato', () => {
    const units = [ru('right', 'a'), ru('right', 'b')]
    const f = frame({ 'right:a': 0, 'right:b': 40 }, { 'right:a': [venom(8)], 'right:b': [venom(1)] })
    expect(focusEnemy(f, units, 'left')?.id).toBe('b') // a è morto
  })
  it('senza veleno, segue il bersaglio nemico vivo dell’azione', () => {
    const units = [ru('right', 'a'), ru('right', 'b')]
    const entry = { targetSide: 'right', targetId: 'b' } as ReplayFrame['entry']
    const f = frame({ 'right:a': 50, 'right:b': 40 }, {}, entry)
    expect(focusEnemy(f, units, 'left')?.id).toBe('b')
  })
  it('senza veleno e senza bersaglio nemico valido → null', () => {
    const units = [ru('right', 'a')]
    const f = frame({ 'right:a': 50 }, {}, null)
    expect(focusEnemy(f, units, 'left')).toBeNull()
  })
})

describe('turnsToDie', () => {
  it('ceil(hp/perTurn), null se perTurn<=0', () => {
    expect(turnsToDie(50, 20)).toBe(3)
    expect(turnsToDie(50, 0)).toBeNull()
  })
})
