import { describe, it, expect } from 'vitest'
import { applyTenaciaAura } from '@/game/engine/combat/roleCounter'
import { mkUnit } from './_roleTestUtils'

describe('applyTenaciaAura', () => {
  it('grants controlResist to a side with a live Supporto, not to one without', () => {
    const L = [mkUnit({ id: 'sup', role: 'Supporto', side: 'left' }), mkUnit({ id: 'att', role: 'Attaccante', side: 'left' })]
    const R = [mkUnit({ id: 'tank', role: 'Tank', side: 'right' })]
    applyTenaciaAura(L, R)
    expect(L.every(u => u.controlResist)).toBe(true)
    expect(R.every(u => u.controlResist)).toBe(false)
  })
  it('drops the aura when the last Supporto is dead', () => {
    const L = [mkUnit({ id: 'sup', role: 'Supporto', side: 'left', alive: false }), mkUnit({ id: 'att', role: 'Attaccante', side: 'left' })]
    applyTenaciaAura(L, [])
    expect(L.every(u => u.controlResist)).toBe(false)
  })
})
