import { describe, it, expect } from 'vitest'
import { ARCHETYPE_BY_TAG } from '@/lib/archetypes'

describe('ARCHETYPE_BY_TAG', () => {
  it('mappa i 4 tag ai nomi fantasia', () => {
    expect(ARCHETYPE_BY_TAG.veleno.name).toBe('Veleno')
    expect(ARCHETYPE_BY_TAG.esecuzione.name).toBe('Carnefice')
    expect(ARCHETYPE_BY_TAG.scudirigen.name).toBe('Muro')
    expect(ARCHETYPE_BY_TAG.magieOscure.name).toBe('Magie Oscure')
  })
  it('magieOscure NON ha synergyId (no sinergia Oscurità); gli altri 3 sì', () => {
    expect(ARCHETYPE_BY_TAG.magieOscure.synergyId).toBeUndefined()
    expect(ARCHETYPE_BY_TAG.veleno.synergyId).toBe('tossicita')
    expect(ARCHETYPE_BY_TAG.esecuzione.synergyId).toBe('spietatezza')
    expect(ARCHETYPE_BY_TAG.scudirigen.synergyId).toBe('bastione')
  })
})
