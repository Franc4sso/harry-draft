/** Mappa un tag archetipo al nome FANTASIA (Veleno/Carnefice/Muro/Magie Oscure), glifo e colore per la UI.
 *  Ogni tag ha ora un synergyId (la sua Costellazione): veleno→tossicita, esecuzione→spietatezza,
 *  scudirigen→bastione, magieOscure→oscurita (Patto Oscuro). */
export const ARCHETYPE_BY_TAG: Record<'veleno' | 'esecuzione' | 'scudirigen' | 'magieOscure', { name: string; glyph: string; color: string; synergyId?: string }> = {
  veleno:      { name: 'Veleno',       glyph: '☠', color: '#7ddc7d', synergyId: 'tossicita' },
  esecuzione:  { name: 'Carnefice',    glyph: '✖', color: '#ff8a7a', synergyId: 'spietatezza' },
  scudirigen:  { name: 'Muro',         glyph: '⛨', color: '#7db7ff', synergyId: 'bastione' },
  magieOscure: { name: 'Magie Oscure', glyph: '☾', color: '#b98cff', synergyId: 'oscurita' },
}

/** Cosa fa l'archetipo quando è attivo (mostrato nelle Costellazioni). Per synergyId. */
export const ARCHETYPE_EFFECT: Record<string, string> = {
  tossicita:   'Il veleno vince la corsa: il tuo DoT sale e si propaga.',
  spietatezza: 'Valanga di uccisioni: ogni kill monta forza e soglia di esecuzione.',
  bastione:    'Muro riflettente: chi ha uno scudo rimanda il danno assorbito.',
  oscurita:    'Patto oscuro: le tue magie oscure colpiscono più forte, al prezzo del contraccolpo.',
}

/** Testo tooltip per il nastro/archetipo di un tag. Se il tag ha una sinergia (synergyId),
 *  mostra l'effetto della Costellazione; altrimenti un fallback generico col nome fantasia. */
export function archetypeTooltip(tag: keyof typeof ARCHETYPE_BY_TAG): string {
  const meta = ARCHETYPE_BY_TAG[tag]
  const effect = meta.synergyId ? ARCHETYPE_EFFECT[meta.synergyId] : undefined
  return effect ?? `Archetipo: ${meta.name}`
}
