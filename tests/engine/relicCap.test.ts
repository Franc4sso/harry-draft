import { describe, it, expect } from 'vitest'
import { addRelicWithChoice, addRelicAutoDrop } from '@/game/engine/relics'
import type { ActiveRelic } from '@/types'
import type { RelicRarity } from '@/types/relic'

const mk = (id: string, rarity: RelicRarity, stage = 0): ActiveRelic =>
  ({ relic: { id, name: id, desc: '', rarity, bonus: {} }, stageObtained: stage } as ActiveRelic)

const five = () => [mk('a','comune'), mk('b','comune',1), mk('c','rara',2), mk('d','epica',3), mk('e','non-comune',4)]

describe('addRelicWithChoice', () => {
  it('appends when under the cap', () => {
    const out = addRelicWithChoice([mk('a','comune')], mk('n','rara'))
    expect(out.map(r => r.relic.id)).toEqual(['a','n'])
  })
  it('replaces the chosen relic when at the cap', () => {
    const out = addRelicWithChoice(five(), mk('n','epica'), 'c')
    expect(out).toHaveLength(5)
    expect(out.map(r => r.relic.id)).toEqual(['a','b','n','d','e']) // ordine preservato, c→n
  })
  it('is a reference-equal no-op at the cap without a replaceId', () => {
    const relics = five()
    expect(addRelicWithChoice(relics, mk('n','epica'))).toBe(relics)
  })
  it('is a reference-equal no-op at the cap when replaceId is not owned', () => {
    const relics = five()
    expect(addRelicWithChoice(relics, mk('n','epica'), 'zzz')).toBe(relics)
  })
})

describe('addRelicAutoDrop', () => {
  it('appends when under the cap', () => {
    const out = addRelicAutoDrop([mk('a','comune')], mk('n','rara'))
    expect(out.map(r => r.relic.id)).toEqual(['a','n'])
  })
  it('drops the lowest-rarity relic at the cap', () => {
    // five(): a=comune,b=comune,c=rara,d=epica,e=non-comune → lowest rarity = comune, oldest = a
    const out = addRelicAutoDrop(five(), mk('n','epica'))
    expect(out).toHaveLength(5)
    expect(out.map(r => r.relic.id)).not.toContain('a') // 'a' (comune, più vecchia) scartata
    expect(out.map(r => r.relic.id)).toContain('n')
  })
  it('breaks rarity ties by oldest (lowest stageObtained/index)', () => {
    const relics = [mk('a','comune',5), mk('b','comune',2), mk('c','rara',0), mk('d','rara',1), mk('e','epica',3)]
    const out = addRelicAutoDrop(relics, mk('n','epica'))
    // due comuni: b (stage 2) è più vecchia di a (stage 5) → scarta b
    expect(out.map(r => r.relic.id)).not.toContain('b')
    expect(out.map(r => r.relic.id)).toContain('a')
  })
})
