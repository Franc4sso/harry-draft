import { describe, it, expect } from 'vitest'
import { spellVfxFor } from '@/lib/vfx/spellVfx'
import { SPELL_BY_ID } from '@/data/spells'
import { ROLE_SPELL_WHITELIST } from '@/lib/roleSpellPools'

describe('every Supporto-kit spell has a bespoke VFX', () => {
  it('spellVfxFor returns a config for each (by spell NAME)', () => {
    const missing: string[] = []
    for (const id of ROLE_SPELL_WHITELIST.Supporto) {
      const name = SPELL_BY_ID[id]?.name
      if (!name) continue
      if (!spellVfxFor(name)) missing.push(`${id} (${name})`)
    }
    expect(missing, `no VFX entry: ${missing.join(', ')}`).toEqual([])
  })
})
