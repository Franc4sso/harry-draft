import { describe, it, expect } from 'vitest'
import { archetypeTooltip } from '@/lib/archetypes'

describe('archetypeTooltip', () => {
  it('ritorna il testo effetto per un tag con synergyId', () => {
    // scudirigen -> bastione
    expect(archetypeTooltip('scudirigen')).toBe(
      'Muro riflettente: chi ha uno scudo rimanda il danno assorbito.',
    )
  })

  it('usa un fallback generico per un tag senza synergyId', () => {
    // magieOscure non ha synergyId finché Patto Oscuro non è merged
    expect(archetypeTooltip('magieOscure')).toBe('Archetipo: Magie Oscure')
  })
})
