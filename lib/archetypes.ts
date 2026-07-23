/** Mappa un tag archetipo al nome FANTASIA (Veleno/Carnefice/Muro), glifo e colore per la UI.
 *  magieOscure ha il nastro ma NESSUN synergyId (la sinergia Oscurità non esiste ancora — Patto Oscuro). */
export const ARCHETYPE_BY_TAG: Record<'veleno' | 'esecuzione' | 'scudirigen' | 'magieOscure', { name: string; glyph: string; color: string; synergyId?: string }> = {
  veleno:      { name: 'Veleno',       glyph: '☠', color: '#7ddc7d', synergyId: 'tossicita' },
  esecuzione:  { name: 'Carnefice',    glyph: '✖', color: '#ff8a7a', synergyId: 'spietatezza' },
  scudirigen:  { name: 'Muro',         glyph: '⛨', color: '#7db7ff', synergyId: 'bastione' },
  magieOscure: { name: 'Magie Oscure', glyph: '☾', color: '#b98cff' },
}

/** Cosa fa l'archetipo quando è attivo (mostrato nelle Costellazioni). Per synergyId. */
export const ARCHETYPE_EFFECT: Record<string, string> = {
  tossicita:   'Il veleno vince la corsa: il tuo DoT sale e si propaga.',
  spietatezza: 'Valanga di uccisioni: ogni kill monta forza e soglia di esecuzione.',
  bastione:    'Muro riflettente: chi ha uno scudo rimanda il danno assorbito.',
}
