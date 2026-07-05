import { describe, it, expect } from 'vitest'
import { pickSpell } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import type { Wizard } from '@/types'

const ctl: Wizard = {
  id: 'w', name: 'W', house: 'Corvonero', role: 'Controllo',
  ranges: { hp: [80,80], atk: [20,20], def: [10,10], spd: [10,10] },
  spellPool: ['bombarda', 'confundo', 'reducto'], // one Controllo spell among attacks
} as never

describe('spell↔role bias', () => {
  it('a Controllo equips a Controllo-type spell when its pool has one (any seed)', () => {
    for (const s of ['a','b','c','d','e','f']) {
      expect(pickSpell(createRng(s), ctl).type).toBe('Controllo')
    }
  })
  it('falls back to the whole pool when no role-type spell exists', () => {
    const noCtl = { ...ctl, spellPool: ['bombarda', 'reducto'] } as never
    expect(['Attacco']).toContain(pickSpell(createRng('a'), noCtl).type)
  })
})
