import { STATUS_BY_ID } from '@/data/statuses'
import type { ActiveEffect } from '@/types'

/**
 * Le pillole e l'aura del volto in battaglia — game/engine e data restano la fonte di
 * verità sui NUMERI (stacks, remaining, absorbLeft); questo modulo decide solo la
 * PRESENTAZIONE: quanti glifi mostrare e con quale totale.
 *
 * Correzione dell'utente (2026-09-16): «I VELENI, COME LE BRUCIATURE E COME GLI SCUDI,
 * VANNO SOMMATI, NON MI METTERE 3 ICONE PER 3 VELENI» — una pillola per famiglia, mai
 * due icone uguali sulla stessa card.
 */

export interface Pillola {
  /** Famiglia visiva: veleno, burn, stun, freeze, silence, disarm, shield, regen, buff, debuff. */
  kind: string
  glyph: string
  color: string
  /** Il numero da mostrare: dosi per i DoT, punti assorbibili per lo scudo, turni per il resto.
   *  `undefined` quando non c'è nulla di utile da contare. */
  count?: number
  label: string
}

/** Le uniche famiglie visive che esistono. Chiuso di proposito: `familyOf` può SOLO
 *  restituire uno di questi valori (verificato dal compilatore, vedi sotto), quindi
 *  `FAMILY_META[family]` non può mai mancare — non serve e non esiste un fallback. */
type Family = 'stun' | 'freeze' | 'silence' | 'disarm' | 'regen' | 'shield' | 'veleno' | 'burn' | 'buff' | 'debuff'

/**
 * Famiglia visiva per ciascuno dei 24 id in `data/statuses.ts`. Il `kind` dello StatusDef
 * (StatusKind) NON basta da solo: `burn` e `veleno` condividono `kind:'dot'` ma devono
 * restare pillole DISTINTE (la correzione dell'utente riguarda esattamente il veleno).
 * Ogni voce sotto ha glifo e colore univoci — nessuno condiviso tra famiglie.
 */
const FAMILY_META: Record<Family, { glyph: string; color: string; label: string }> = {
  // Riusa EFFECT_META (lib/glossary.ts) dove la chiave combacia 1:1 con uno StatusKind:
  // stun, freeze, silence, disarm, regen, shield → stesso colore del resto della UI.
  stun: { glyph: '⚡', color: '#C98BFF', label: 'Stordito' },
  freeze: { glyph: '❄', color: '#7DD3FF', label: 'Congelato' },
  silence: { glyph: '🔇', color: '#B59CFF', label: 'Silenziato' },
  disarm: { glyph: '✋', color: '#FFD37D', label: 'Disarmato' },
  regen: { glyph: '✨', color: '#7CFC9B', label: 'Rigenerazione' },
  shield: { glyph: '🛡', color: '#7DB7FF', label: 'Scudo' },
  // dot si spacca in due famiglie distinte — EFFECT_META.dot è un'unica voce condivisa,
  // qui serve differenziarle: veleno tiene il colore/icona di EFFECT_META.dot (Flame,
  // #FF7A7A) essendo il caso che ha originato la correzione; burn prende un rosso più
  // caldo/arancio per restare inconfondibile accanto al veleno sulla stessa card.
  veleno: { glyph: '☠', color: '#FF7A7A', label: 'Veleno' },
  burn: { glyph: '🔥', color: '#FF9B4A', label: 'Bruciatura' },
  // buff/debuff generici: EFFECT_META.buff/.debuff.
  buff: { glyph: '▲', color: '#7CFC9B', label: 'Potenziato' },
  debuff: { glyph: '▼', color: '#FFB37D', label: 'Indebolito' },
}

/**
 * Mappa ogni id del catalogo (`data/statuses.ts`) alla sua famiglia visiva.
 *
 * FALLISCE RUMOROSAMENTE (throw) su un id sconosciuto o un `StatusKind` non gestito,
 * invece di restituire un valore qualunque che poi degraderebbe in silenzio al
 * segnaposto ('•') in `pilloleDi`. Un id fuori catalogo o un nuovo StatusKind aggiunto
 * a `data/statuses.ts` senza toccare questa funzione deve rompere subito, non spedire
 * un pallino grigio in produzione — è esattamente il buco che la review ha trovato.
 */
function familyOf(statusId: string): Family {
  if (statusId === 'burn' || statusId === 'veleno') return statusId
  const def = STATUS_BY_ID[statusId]
  if (!def) throw new Error(`battleStacks: id di stato sconosciuto "${statusId}" — non è in data/statuses.ts`)
  if (def.kind === 'buff' || def.kind === 'debuff') return def.kind
  // 'ward' (protego) è concettualmente uno scudo (family:'shield' in data/statuses.ts):
  // stessa pillola.
  if (def.kind === 'ward') return 'shield'
  if (def.kind === 'stun' || def.kind === 'freeze' || def.kind === 'silence'
    || def.kind === 'disarm' || def.kind === 'regen' || def.kind === 'shield') return def.kind
  // def.kind === 'dot' qui significa un ID diverso da burn/veleno con kind:'dot' — non
  // esiste ancora nel catalogo, e non ha una famiglia visiva assegnata. Rumoroso apposta.
  throw new Error(`battleStacks: nessuna famiglia visiva per lo StatusKind "${def.kind}" (id "${statusId}")`)
}

/** Il conteggio "giusto" per una famiglia: dosi per i DoT, punti per lo scudo, turni per il resto. */
function countFor(family: Family, effects: ActiveEffect[]): number | undefined {
  if (family === 'shield') {
    const total = effects.reduce((sum, e) => sum + (e.absorbLeft ?? 0), 0)
    return total > 0 ? total : undefined
  }
  if (family === 'veleno' || family === 'burn') {
    const total = effects.reduce((sum, e) => sum + (e.stacks ?? 1), 0)
    return total > 0 ? total : undefined
  }
  // Resto (control/buff/debuff/regen): turni rimanenti, il più lungo tra le voci.
  const remainings = effects.map(e => e.remaining).filter(r => typeof r === 'number')
  if (remainings.length === 0) return undefined
  return Math.max(...remainings)
}

/** Le pillole di un'unità: UNA per famiglia, col totale. Mai due icone uguali. */
export function pilloleDi(effects: ActiveEffect[]): Pillola[] {
  const byFamily = new Map<Family, ActiveEffect[]>()
  for (const e of effects) {
    const id = e.statusId ?? e.kind
    const family = familyOf(id)
    const list = byFamily.get(family)
    if (list) list.push(e)
    else byFamily.set(family, [e])
  }

  const out: Pillola[] = []
  for (const [family, group] of byFamily) {
    // Nessun fallback: `family` è tipizzato `Family`, quindi questa entry esiste sempre.
    // Un id senza famiglia visiva è già fallito rumorosamente dentro `familyOf`.
    const meta = FAMILY_META[family]
    out.push({
      kind: family,
      glyph: meta.glyph,
      color: meta.color,
      count: countFor(family, group),
      label: meta.label,
    })
  }
  return out
}

/** Famiglie che bloccano il turno: la loro aura si accende sempre, indipendentemente dai numeri. */
const TURN_BLOCKING = new Set<Family>(['stun', 'freeze'])

/** Soglia minima di dosi perché un DoT "pesi" abbastanza da meritare l'aura. Una dose sola
 *  è solo una pillola: misurato che animare un'aura per ogni dose singola propagata (es. il
 *  Duo Miasma su cinque alleati) è illeggibile e costa 19fps contro 52. */
const DOT_AURA_MIN_STACKS = 2

/** Ordine di gravità per l'aura: a parità di più stati attivi, vince il primo di questa
 *  lista. Copre SOLO le famiglie che `auraDi` può effettivamente mettere in `candidates`
 *  — i turn-blocker (`TURN_BLOCKING`) e i DoT sopra soglia (`DOT_AURA_MIN_STACKS`). Non
 *  contiene `silence`/`disarm`: oggi non bloccano il turno e non sono DoT, quindi non
 *  possono mai finire in `candidates` — un id qui che `candidates` non può mai contenere
 *  sarebbe morto e fuorviante per chi legge dopo. Se un domani silence/disarm dovessero
 *  accendere un'aura propria, vanno aggiunti QUI *e* al ramo che popola `candidates`
 *  sotto, altrimenti torna a essere una bugia.
 */
const SEVERITY_ORDER: Family[] = ['freeze', 'stun', 'veleno', 'burn']

/** L'aura della cornice, o null. Intensità, non presenza. */
export function auraDi(effects: ActiveEffect[]): { kind: string; color: string } | null {
  const candidates = new Set<Family>()

  for (const e of effects) {
    const id = e.statusId ?? e.kind
    const family = familyOf(id)
    if (TURN_BLOCKING.has(family)) {
      candidates.add(family)
      continue
    }
    if (family === 'veleno' || family === 'burn') {
      const stacks = e.stacks ?? 1
      if (stacks >= DOT_AURA_MIN_STACKS) candidates.add(family)
    }
  }

  if (candidates.size === 0) return null

  const winner = SEVERITY_ORDER.find(k => candidates.has(k)) ?? [...candidates][0]!
  const meta = FAMILY_META[winner]
  return { kind: winner, color: meta.color }
}
