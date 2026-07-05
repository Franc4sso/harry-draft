import { describe, it, expect } from 'vitest'
import { WIZARDS } from '@/data/wizards'
import { SPELL_BY_ID } from '@/data/spells'
import { ROLE_SPELL_TYPES } from '@/game/engine/statRoll'

describe('role spell-pool invariant', () => {
  it('every wizard has at least one spell of its role type in its pool', () => {
    const violators = WIZARDS.filter(w => {
      const types = ROLE_SPELL_TYPES[w.role]
      return !w.spellPool.some(id => types.includes(SPELL_BY_ID[id]?.type as never))
    }).map(w => `${w.id} (${w.role})`)
    expect(violators, `wizards missing a role-type spell:\n${violators.join('\n')}`).toEqual([])
  })
})
