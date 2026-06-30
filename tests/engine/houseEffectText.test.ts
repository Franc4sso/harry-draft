import { describe, it, expect } from 'vitest'
import { houseEffectText } from '@/game/engine/houseEffects'

describe('houseEffectText', () => {
  it('Grifondoro: dodge % per tier', () => {
    expect(houseEffectText('Grifondoro', 0)).toBe('Schivata +4%')
    expect(houseEffectText('Grifondoro', 1)).toBe('Schivata +8%')
    expect(houseEffectText('Grifondoro', 2)).toBe('Schivata +14%')
  })
  it('Corvonero: crit chance + total multiplier per tier', () => {
    expect(houseEffectText('Corvonero', 0)).toBe('Critico 18% (×1.7)')
    expect(houseEffectText('Corvonero', 1)).toBe('Critico 26% (×2.0)')
    expect(houseEffectText('Corvonero', 2)).toBe('Critico 36% (×2.3)')
  })
  it('Tassorosso: damage reduction % per tier', () => {
    expect(houseEffectText('Tassorosso', 0)).toBe('Riduzione danno 10%')
    expect(houseEffectText('Tassorosso', 1)).toBe('Riduzione danno 16%')
    expect(houseEffectText('Tassorosso', 2)).toBe('Riduzione danno 24%')
  })
  it('Serpeverde: bonus damage vs wounded per tier', () => {
    expect(houseEffectText('Serpeverde', 0)).toBe('+10% danno a feriti')
    expect(houseEffectText('Serpeverde', 1)).toBe('+18% danno a feriti')
    expect(houseEffectText('Serpeverde', 2)).toBe('+28% danno a feriti')
  })
})
