import { describe, it, expect } from 'vitest'
import { RELIC_BY_ID, RULE_BREAKING_RELIC_IDS } from '@/data/relics'

describe('rule-breaking relic pool', () => {
  it('every id in the pool resolves to a real relic', () => {
    // Soglia 3 -> 2 (Onda 1.f, 2026-07-28): `furia-iniziale` e' uscita dal pool perche' era
    // un +stat piatto, non un rompi-regole. Il 3 era una soglia arbitraria di grandezza, non
    // una legge di design; abbassarla e' onesto, gonfiare il pool promuovendoci una reliquia
    // gia' pescabile dall'offerta normale (es. lacrime-fenice) lo sarebbe stato meno — gli
    // eventi devono dare cose che NON trovi altrove. Sotto 2 invece la varieta' morirebbe:
    // questo resta un gate vero.
    expect(RULE_BREAKING_RELIC_IDS.length).toBeGreaterThanOrEqual(2)
    for (const id of RULE_BREAKING_RELIC_IDS) expect(RELIC_BY_ID[id]).toBeDefined()
  })
  it('the pool relics use only existing hook shapes (no unknown mechanic fields)', () => {
    for (const id of RULE_BREAKING_RELIC_IDS) {
      const r = RELIC_BY_ID[id]!
      const usesKnown = !!(r.triggers || r.grantsDarkMagic || r.bonus || r.keywordMult)
      expect(usesKnown).toBe(true)
    }
  })
})
