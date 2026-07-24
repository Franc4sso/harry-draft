import { describe, it, expect } from 'vitest'
import { detectSynergies } from '@/game/engine/synergy'
import { teamDarkMagic } from '@/game/engine/darkMagic'
import type { DraftedWizard } from '@/types'

const dw = (id: string, tags: string[] = []): DraftedWizard =>
  ({ wizard: { id, role: 'Attaccante', house: 'Serpeverde', tags }, level: 1 } as unknown as DraftedWizard)

describe('sinergia oscurita (archetipo Patto Oscuro)', () => {
  it('si accende con 3 maghi magieOscure, non con 2', () => {
    const three = [dw('a', ['magieOscure']), dw('b', ['magieOscure']), dw('c', ['magieOscure'])]
    const two = [dw('a', ['magieOscure']), dw('b', ['magieOscure'])]
    expect(detectSynergies(three).map(s => s.synergy.id)).toContain('oscurita')
    expect(detectSynergies(two).map(s => s.synergy.id)).not.toContain('oscurita')
  })

  it('con la sinergia attiva, ogni dark caster riceve un bonus > 0 (branch darkMagic acceso)', () => {
    const team = [dw('a', ['magieOscure']), dw('b', ['magieOscure']), dw('c', ['magieOscure'])]
    const syn = detectSynergies(team)
    const map = teamDarkMagic(team, [], syn)
    // synBonus 0.3, scalato da keywordMult magieOscure 0.5 → 0.3 * (1 + 0.5) = 0.45
    expect(map['a']!.bonus).toBeGreaterThan(0)
    expect(map['b']!.bonus).toBeGreaterThan(0)
    expect(map['c']!.bonus).toBeGreaterThan(0)
    expect(map['a']!.recoil).toBe(0) // la sinergia NON dà recoil (solo il Marchio lo fa)
  })

  it('senza la sinergia (2 maghi), teamDarkMagic non dà bonus di sinergia', () => {
    const two = [dw('a', ['magieOscure']), dw('b', ['magieOscure'])]
    const syn = detectSynergies(two)
    const map = teamDarkMagic(two, [], syn)
    expect(map['a']).toBeUndefined()
  })
})
