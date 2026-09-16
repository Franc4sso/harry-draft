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

/**
 * Famiglia visiva per ciascuno dei 24 id in `data/statuses.ts`. Il `kind` dello StatusDef
 * (StatusKind) NON basta da solo: `burn` e `veleno` condividono `kind:'dot'` ma devono
 * restare pillole DISTINTE (la correzione dell'utente riguarda esattamente il veleno).
 * Ogni voce sotto ha glifo e colore univoci — nessuno condiviso tra famiglie.
 */
const FAMILY_META: Record<string, { glyph: string; color: string; label: string }> = {
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

/** Mappa ogni id del catalogo (`data/statuses.ts`) alla sua famiglia visiva. */
function familyOf(statusId: string): string {
  const def = STATUS_BY_ID[statusId]
  if (!def) return statusId
  if (statusId === 'burn' || statusId === 'veleno') return statusId
  if (def.kind === 'buff' || def.kind === 'debuff') return def.kind
  // stun/freeze/silence/disarm/regen/shield/ward — 'ward' (protego) è concettualmente
  // uno scudo (family:'shield' in data/statuses.ts): stessa pillola.
  if (def.kind === 'ward') return 'shield'
  return def.kind
}

/** Il conteggio "giusto" per una famiglia: dosi per i DoT, punti per lo scudo, turni per il resto. */
function countFor(family: string, effects: ActiveEffect[]): number | undefined {
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
  const byFamily = new Map<string, ActiveEffect[]>()
  for (const e of effects) {
    const id = e.statusId ?? e.kind
    const family = familyOf(id)
    const list = byFamily.get(family)
    if (list) list.push(e)
    else byFamily.set(family, [e])
  }

  const out: Pillola[] = []
  for (const [family, group] of byFamily) {
    const meta = FAMILY_META[family] ?? { glyph: '•', color: '#9aa3ad', label: family }
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
const TURN_BLOCKING = new Set(['stun', 'freeze'])

/** Soglia minima di dosi perché un DoT "pesi" abbastanza da meritare l'aura. Una dose sola
 *  è solo una pillola: misurato che animare un'aura per ogni dose singola propagata (es. il
 *  Duo Miasma su cinque alleati) è illeggibile e costa 19fps contro 52. */
const DOT_AURA_MIN_STACKS = 2

/** Ordine di gravità: a parità di più stati attivi, vince il primo di questa lista. */
const SEVERITY_ORDER = ['freeze', 'stun', 'silence', 'disarm', 'veleno', 'burn']

/** L'aura della cornice, o null. Intensità, non presenza. */
export function auraDi(effects: ActiveEffect[]): { kind: string; color: string } | null {
  const candidates = new Set<string>()

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
  return { kind: winner, color: meta?.color ?? '#9aa3ad' }
}
