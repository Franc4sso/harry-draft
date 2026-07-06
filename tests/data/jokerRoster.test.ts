import { describe, it, expect } from 'vitest'
import { RELICS, JOKER_RELIC_IDS } from '@/data/relics'
import { STARTER_RELICS } from '@/data/unlocks'

const NEW_JOKERS = [
  'marcia-di-guerra', 'fortezza-vivente', 'vento-crescente', 'eredita-dei-caduti',
  'ultimo-baluardo', 'branco-ristretto', 'furia-morente', 'canto-del-cigno',
  'assalto-d-apertura', 'patto-vorace', 'sete-di-sangue',
]

describe('joker roster', () => {
  it('all new jokers exist in RELICS', () => {
    for (const id of NEW_JOKERS) {
      expect(RELICS.find(r => r.id === id), id).toBeTruthy()
    }
  })
  it('all new jokers are in JOKER_RELIC_IDS and STARTER_RELICS', () => {
    for (const id of NEW_JOKERS) {
      expect(JOKER_RELIC_IDS.includes(id), `${id} joker set`).toBe(true)
      expect(STARTER_RELICS.includes(id), `${id} starter`).toBe(true)
    }
  })
  it('scaling jokers have valid trigger/stat/cap', () => {
    for (const r of RELICS.filter(r => JOKER_RELIC_IDS.includes(r.id) && r.scaling)) {
      expect(r.scaling!.cap).toBeGreaterThan(0)
      expect(r.scaling!.per).toBeGreaterThan(0)
    }
  })
  it('every joker has italian name and desc', () => {
    for (const id of JOKER_RELIC_IDS) {
      const r = RELICS.find(x => x.id === id)!
      expect(r.name.length).toBeGreaterThan(0)
      expect(r.desc.length).toBeGreaterThan(0)
    }
  })
})
