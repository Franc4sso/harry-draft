import { describe, it, expect } from 'vitest'
import { cn, houseTheme, roleIconName, tierLabel, tierColor } from '@/lib/theme'

describe('cn', () => {
  it('joins truthy classes only', () => {
    expect(cn('a', false, 'b', null, undefined, 'c')).toBe('a b c')
  })
})

describe('houseTheme', () => {
  it('returns color and glow from house data', () => {
    const t = houseTheme('Grifondoro')
    expect(t.color).toBe('#ae0001')
    expect(t.glow).toBe('#ffc500')
    expect(t.gradient).toContain('#ae0001')
    expect(t.ring).toContain('#ffc500')
  })
  it('covers all four houses', () => {
    for (const h of ['Grifondoro', 'Serpeverde', 'Corvonero', 'Tassorosso'] as const) {
      expect(houseTheme(h).color).toMatch(/^#/)
    }
  })
})

describe('role + tier helpers', () => {
  it('maps roles to lucide icon names', () => {
    expect(roleIconName('Attaccante')).toBe('Swords')
    expect(roleIconName('Tank')).toBe('Shield')
    expect(roleIconName('Supporto')).toBe('Heart')
    expect(roleIconName('Controllo')).toBe('Wand2')
  })
  it('labels and colors tiers', () => {
    expect(tierLabel(1)).toBe('Leggendario')
    expect(tierLabel(4)).toBe('Comune')
    expect(tierColor(1)).toMatch(/^#/)
    expect(tierColor(4)).toMatch(/^#/)
  })
})
