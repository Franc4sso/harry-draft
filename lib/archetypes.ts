import type { SignalTier2 } from '@/game/engine/duos'
import type { DuoSignal } from '@/types'

/** Mappa un tag archetipo al nome FANTASIA (Veleno/Carnefice/Muro/Magie Oscure), glifo e colore per la UI.
 *  Ogni tag ha ora un synergyId (la sua Costellazione): veleno→tossicita, esecuzione→spietatezza,
 *  scudirigen→bastione, magieOscure→oscurita (Patto Oscuro). */
export const ARCHETYPE_BY_TAG: Record<'veleno' | 'esecuzione' | 'scudirigen' | 'magieOscure', { name: string; glyph: string; color: string; synergyId?: string }> = {
  veleno:      { name: 'Veleno',       glyph: '☠', color: '#7ddc7d', synergyId: 'tossicita' },
  esecuzione:  { name: 'Carnefice',    glyph: '✖', color: '#ff8a7a', synergyId: 'spietatezza' },
  scudirigen:  { name: 'Muro',         glyph: '⛨', color: '#7db7ff', synergyId: 'bastione' },
  magieOscure: { name: 'Magie Oscure', glyph: '☾', color: '#b98cff', synergyId: 'oscurita' },
}

/** Cosa fa l'archetipo quando è attivo — cioè quando il suo segnale arriva al **grado 2**
 *  «potenziato» (3 maghi col tag). Indicizzato per synergyId, che è anche `SignalTier2.id`. */
export const ARCHETYPE_EFFECT: Record<string, string> = {
  tossicita:   'Il veleno vince la corsa: il tuo DoT sale e si propaga.',
  spietatezza: 'Valanga di uccisioni: ogni kill monta forza e soglia di esecuzione.',
  bastione:    'Muro riflettente: chi ha uno scudo rimanda il danno assorbito.',
  oscurita:    'Patto oscuro: le tue magie oscure colpiscono più forte, al prezzo del contraccolpo.',
}

/** Il complemento della frase del bonus di grado 2, per segnale: "+50% <questo>".
 *  La PERCENTUALE non si scrive qui — la compone `tier2BonusText` leggendo `SignalTier2.mult`,
 *  unica fonte di verità del bonus (game/engine/duos.ts). Qui vive solo il complemento in
 *  italiano, così il pannello del draft dice al giocatore cosa compra col terzo mago. */
const TIER2_TARGET: Partial<Record<DuoSignal, string>> = {
  veleno: 'ai danni da veleno',
  esecuzione: 'al bonus di esecuzione',
  scudirigen: 'agli scudi generati',
  magieOscure: 'ai danni delle magie oscure',
}

/** "+50% ai danni da veleno" — il bonus del grado 2 detto in italiano, con la percentuale
 *  derivata dal tier (mai copiata a mano). */
export function tier2BonusText(tier: SignalTier2): string {
  const target = TIER2_TARGET[tier.signal] ?? `alla parola chiave ${tier.keyword}`
  return `+${Math.round(tier.mult * 100)}% ${target}`
}

/** Testo tooltip per il nastro/archetipo di un tag. Se il tag ha una sinergia (synergyId),
 *  mostra l'effetto della Costellazione; altrimenti un fallback generico col nome fantasia. */
export function archetypeTooltip(tag: keyof typeof ARCHETYPE_BY_TAG): string {
  const meta = ARCHETYPE_BY_TAG[tag]
  const effect = meta.synergyId ? ARCHETYPE_EFFECT[meta.synergyId] : undefined
  return effect ?? `Archetipo: ${meta.name}`
}
