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
  it('includes house, role, and group memberships', () => {
    const ids = wizardAffiliations(harry).map((a) => a.synergyId)
    expect(ids).toContain('gryffindor3')   // house
    expect(ids).toContain('attackers3')    // role
    expect(ids).toContain('goldenTrio')    // by id membership
    expect(ids).toContain('order')         // by tag
    expect(ids).toContain('da')            // by tag
  })
  it('excludes synergies the wizard cannot join', () => {
    const ids = wizardAffiliations(harry).map((a) => a.synergyId)
    expect(ids).not.toContain('slytherin3')
    expect(ids).not.toContain('deatheater')
  })
})
