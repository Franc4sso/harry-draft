import { describe, it, expect } from 'vitest'
import { trioEffects } from '@/game/engine/trios'
import type { ActiveDuo, DraftedWizard, Wizard } from '@/types'

function dw(id: string, house: Wizard['house']): DraftedWizard {
  const wizard = { id, name: id, house, role: 'Attaccante', tags: [] } as unknown as Wizard
  return { wizard, stats: { hp: 100, atk: 10, def: 10, spd: 10 }, maxHp: 100, spell: {} as any }
}
const duo: ActiveDuo = { duo: { id: 'cancrena' } as any }

describe('trioEffects', () => {
  it('no Duo active → empty map even with 3 same-house', () => {
    const team = [dw('a', 'Serpeverde'), dw('b', 'Serpeverde'), dw('c', 'Serpeverde')]
    expect(trioEffects(team, [])).toEqual({})
  })

  it('≥1 Duo + 3 same-house → those 3 get the house Trio', () => {
    const team = [dw('a', 'Serpeverde'), dw('b', 'Serpeverde'), dw('c', 'Serpeverde'), dw('d', 'Grifondoro')]
    const map = trioEffects(team, [duo])
    expect(map['a']?.firstStrike?.bonus).toBe(0.30)
    expect(map['d']).toBeUndefined() // only 1 Grifondoro
  })

  it('4 same-house → boosted grade (Serpeverde 0.45)', () => {
    const team = [dw('a', 'Serpeverde'), dw('b', 'Serpeverde'), dw('c', 'Serpeverde'), dw('d', 'Serpeverde')]
    expect(trioEffects(team, [duo])['a']?.firstStrike?.bonus).toBe(0.45)
  })

  it('Tassorosso/Grifondoro boolean grade (3 == 4)', () => {
    const three = [dw('a', 'Tassorosso'), dw('b', 'Tassorosso'), dw('c', 'Tassorosso')]
    const four = [...three, dw('d', 'Tassorosso')]
    expect(trioEffects(three, [duo])['a']?.statusDurationBonus).toBe(1)
    expect(trioEffects(four, [duo])['a']?.statusDurationBonus).toBe(1)
  })

  it('Corvonero grade: 3 → expose1, 4 → expose2', () => {
    const three = [dw('a', 'Corvonero'), dw('b', 'Corvonero'), dw('c', 'Corvonero')]
    const four = [...three, dw('d', 'Corvonero')]
    expect(trioEffects(three, [duo])['a']?.analysis?.exposeId).toBe('expose1')
    expect(trioEffects(four, [duo])['a']?.analysis?.exposeId).toBe('expose2')
  })
})
