import { describe, it, expect } from 'vitest'
import { keywordDamageMult } from '@/game/engine/relics'
import { SYNERGIES } from '@/data/synergies'

const tossicita = SYNERGIES.find(s => s.id === 'tossicita')!

describe('keywordDamageMult sums synergy keywordMult', () => {
  it('Tossicità contributes a veleno multiplier', () => {
    const active = [{ synergy: tossicita, memberIds: [] }]
    const mult = keywordDamageMult([], [], active, 'veleno')
    expect(mult).toBeGreaterThan(1) // 1 + tossicita.bonus.keywordMult.veleno
  })
  it('no synergy → mult 1', () => {
    expect(keywordDamageMult([], [], [], 'veleno')).toBe(1)
  })
  it('Tossicità exposes keywordMult.veleno and no longer grants atk', () => {
    expect(tossicita.bonus.keywordMult?.veleno).toBeGreaterThan(0)
    expect(tossicita.bonus.atk ?? 0).toBe(0)
  })
})
