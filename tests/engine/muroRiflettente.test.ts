import { describe, it, expect } from 'vitest'
import { detectSynergies } from '@/game/engine/synergy'
import { teamShieldConvert } from '@/game/engine/shieldConvert'
import type { DraftedWizard } from '@/types'

const dw = (id: string, tags: string[] = []): DraftedWizard =>
  ({ wizard: { id, role: 'Tank', house: 'Tassorosso', tags }, level: 1 } as unknown as DraftedWizard)

describe('sinergia bastione (archetipo Muro Riflettente)', () => {
  it('si accende con 3 maghi scudirigen, non con 2', () => {
    const three = [dw('a', ['scudirigen']), dw('b', ['scudirigen']), dw('c', ['scudirigen'])]
    const two = [dw('a', ['scudirigen']), dw('b', ['scudirigen'])]
    expect(detectSynergies(three).map(s => s.synergy.id)).toContain('bastione')
    expect(detectSynergies(two).map(s => s.synergy.id)).not.toContain('bastione')
  })

  it('riaccende il branch shieldConvert morto: rate più alto con bastione', () => {
    const team = [dw('a', ['scudirigen']), dw('b', ['scudirigen']), dw('c', ['scudirigen'])]
    const syn = detectSynergies(team)
    // con una reliquia grantsShieldConvert base + bastione, il rate include il +0.35
    const relic = { relic: { id: 'egida-tassorosso', name: '', desc: '', rarity: 'rara', keywords: ['scudo'], grantsShieldConvert: { rate: 0.5 } } } as any
    const withBastione = teamShieldConvert(team, [relic], syn)
    const withoutBastione = teamShieldConvert(team, [relic], [])
    expect(withBastione!.rate).toBeGreaterThan(withoutBastione!.rate)
  })
})
