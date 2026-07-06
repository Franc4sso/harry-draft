import { describe, it, expect } from 'vitest'
import type { Relic } from '@/types/relic'

describe('extended relic types', () => {
  it('accepts new scaling triggers and stats', () => {
    const r: Relic = {
      id: 'x', name: 'X', desc: 'd', rarity: 'epica',
      scaling: { trigger: 'turn', stat: 'defense', per: 5, cap: 50 },
    }
    expect(r.scaling?.trigger).toBe('turn')
    expect(r.scaling?.stat).toBe('defense')
  })
  it('accepts conditional and drawback', () => {
    const r: Relic = {
      id: 'y', name: 'Y', desc: 'd', rarity: 'epica',
      conditional: { when: { kind: 'teamSizeBelow', value: 2 }, then: { allPct: 0.5 } },
      drawback: { hp: -60 },
    }
    expect(r.conditional?.when.kind).toBe('teamSizeBelow')
    expect(r.drawback?.hp).toBe(-60)
  })
  it('accepts onlyTurn on a trigger', () => {
    const r: Relic = {
      id: 'z', name: 'Z', desc: 'd', rarity: 'epica',
      triggers: [{ hook: 'onTurnStart', onlyTurn: 1, effects: [] }],
    }
    expect(r.triggers?.[0]?.onlyTurn).toBe(1)
  })
})
