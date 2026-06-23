import { describe, it, expect } from 'vitest'
import { rarityStyle } from '@/lib/rarity'

describe('rarityStyle', () => {
  it('labels and colors derive from tier', () => {
    expect(rarityStyle(1).label).toBe('Leggendario')
    expect(rarityStyle(4).label).toBe('Comune')
    expect(rarityStyle(1).color).toBe('#ffd34d')
  })
  it('escalates glow with rarity (comune lowest, leggendario highest)', () => {
    expect(rarityStyle(4).glow).toBeLessThan(rarityStyle(2).glow)
    expect(rarityStyle(2).glow).toBeLessThan(rarityStyle(1).glow)
    expect(rarityStyle(4).glow).toBe(0)
    expect(rarityStyle(1).glow).toBe(1)
  })
  it('only leggendario gets crown + animation; raro+ get a gem', () => {
    expect(rarityStyle(1).hasCrown).toBe(true)
    expect(rarityStyle(2).hasCrown).toBe(false)
    expect(rarityStyle(1).animated).toBe(true)
    expect(rarityStyle(2).animated).toBe(false)
    expect(rarityStyle(3).hasGem).toBe(true)
    expect(rarityStyle(4).hasGem).toBe(false)
  })
  it('every tier yields a non-empty bgGradient', () => {
    for (const t of [1, 2, 3, 4] as const) {
      expect(rarityStyle(t).bgGradient).toMatch(/gradient/)
    }
  })
})
