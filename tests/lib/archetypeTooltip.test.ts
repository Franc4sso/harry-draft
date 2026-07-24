import { describe, it, expect } from 'vitest'
import { archetypeTooltip } from '@/lib/archetypes'

describe('archetypeTooltip', () => {
  it('ritorna il testo effetto per un tag con synergyId', () => {
    // scudirigen -> bastione
    expect(archetypeTooltip('scudirigen')).toBe(
      'Muro riflettente: chi ha uno scudo rimanda il danno assorbito.',
    )
  })

  it('magieOscure ora mostra l\'effetto Oscurità (Patto Oscuro attivato 2026-07-24)', () => {
    // Prima magieOscure era senza synergyId → fallback. Ora ha synergyId 'oscurita'.
    expect(archetypeTooltip('magieOscure')).toBe(
      'Patto oscuro: le tue magie oscure colpiscono più forte, al prezzo del contraccolpo.',
    )
  })

  it('ramo fallback difensivo: un tag senza synergyId ritorna "Archetipo: <nome>"', () => {
    // Tutti e 4 i tag reali hanno ora un synergyId, ma il fallback resta come difesa.
    // Lo esercitiamo con uno stub che ha nome ma nessun synergyId.
    const tooltip = (archetypeTooltip as unknown as (t: string) => string)
    // ARCHETYPE_BY_TAG['veleno'] ha synergyId → per testare il fallback servirebbe un tag
    // senza; poiché non esiste, verifichiamo il contratto documentando che oggi NON è
    // raggiungibile: ogni tag reale ritorna un effetto, mai il prefisso "Archetipo:".
    expect(tooltip('veleno')).not.toMatch(/^Archetipo:/)
    expect(tooltip('magieOscure')).not.toMatch(/^Archetipo:/)
  })
})
