import { describe, it, expect } from 'vitest'
import type { Wizard } from '@/types'
import { wizardAffiliations } from '@/lib/affiliations'

const harry: Wizard = {
  id: 'harry', name: 'Harry', house: 'Grifondoro', role: 'Attaccante', tier: 1,
  gender: 'm',
  ranges: { hp: [110, 135], atk: [22, 38], def: [16, 28], spd: [22, 32] },
  spellPool: ['x'], tags: ['order', 'da'],
}

describe('wizardAffiliations', () => {
  // goldenTrio/order/da/deatheater/marauder were all removed from SYNERGIES along with the
  // other 8 team synergies (2026-07-21) — Tossicità (tag:veleno) is the only entry left, so a
  // wizard with no 'veleno' tag (like this `harry` fixture) matches nothing at all now.
  it('matches no synergy for a wizard without the veleno tag (all group/tag synergies removed)', () => {
    const ids = wizardAffiliations(harry).map((a) => a.synergyId)
    expect(ids).toEqual([])
  })
  it('matches Tossicità for a wizard carrying the veleno tag', () => {
    const poisoner: Wizard = { ...harry, id: 'poisoner-fixture', tags: ['veleno'] }
    const ids = wizardAffiliations(poisoner).map((a) => a.synergyId)
    expect(ids).toEqual(['tossicita'])
  })
})
