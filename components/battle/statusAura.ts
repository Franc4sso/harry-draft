import type { ActiveEffect } from '@/types'

/** Le nove aure che una cornice può portare. Non una per `id` (24) né per
 *  `family` (6 in `data/statuses.ts`): una per IDEA riconoscibile a colpo
 *  d'occhio — tre gradi di indebolimento/lentezza/vulnerabilità sono la
 *  stessa aura ('debole'), scudo e protego sono la stessa aura ('scudo'). */
export type AuraKind =
  | 'veleno' | 'bruciatura' | 'gelo' | 'silenzio' | 'disarmo'
  | 'scudo' | 'rigenera' | 'controllo' | 'debole'

export interface Aura {
  kind: AuraKind
  /** Classe CSS da mettere sul contenitore dell'unità. */
  className: string
  /** Colore dell'alone, per lo stile inline. */
  color: string
}

const AURA: Record<AuraKind, Omit<Aura, 'kind'>> = {
  gelo:      { className: 'aura-gelo',      color: '#7dd3ff' },
  controllo: { className: 'aura-controllo', color: '#f0d48a' },
  bruciatura:{ className: 'aura-bruciatura',color: '#ffb37d' },
  veleno:    { className: 'aura-veleno',    color: '#8fd98f' },
  silenzio:  { className: 'aura-silenzio',  color: '#c4a3ff' },
  disarmo:   { className: 'aura-disarmo',   color: '#ffd37d' },
  debole:    { className: 'aura-debole',    color: '#ffb37d' },
  scudo:     { className: 'aura-scudo',     color: '#8ab6f0' },
  rigenera:  { className: 'aura-rigenera',  color: '#7cfc9b' },
}

/** Ordine di gravità, dal più grave al meno: la prima aura trovata scorrendo
 *  gli stati dell'unità in QUEST'ordine è quella che vince. Rispecchia
 *  `PRIORITY` nel brief — gelo (salta il turno) batte tutto, rigenera (una
 *  buona notizia) cede a chiunque altro. */
const PRIORITY: AuraKind[] = [
  'gelo', 'controllo', 'bruciatura', 'veleno', 'silenzio',
  'disarmo', 'debole', 'scudo', 'rigenera',
]

/** Mappa ogni `id` dei 24 in `data/statuses.ts` all'aura della sua famiglia.
 *  Deliberatamente NON per `family` di `StatusDef` (che ha solo 6 valori e
 *  fonderebbe scudo/rigenera o disarmo/silenzio/stordimento in una sola
 *  aura): ogni riga qui è la stessa scelta di design della tabella del
 *  brief, non derivata meccanicamente dal tipo. */
const AURA_BY_STATUS_ID: Record<string, AuraKind> = {
  // controllo — un'aura per idea, non per meccanica di "prevents"
  stun: 'controllo',
  freeze: 'gelo',
  silence: 'silenzio',
  disarm: 'disarmo',
  // danno nel tempo
  burn: 'bruciatura',
  veleno: 'veleno',
  // difesa
  shield: 'scudo',
  protego: 'scudo',
  regen: 'rigenera',
  // potenziamenti — una buona notizia per chi li porta, stessa aura del regen
  atkUp: 'rigenera',
  atkUp1: 'rigenera',
  defUp: 'rigenera',
  spdUp: 'rigenera',
  raccolto: 'rigenera',
  // indebolimenti — tre gradi di lentezza, tre di indebolimento, tre di
  // vulnerabilità sono la stessa idea: qualcosa in meno, aura 'debole'
  slow: 'debole',
  slow1: 'debole',
  slow2: 'debole',
  slow3: 'debole',
  weaken1: 'debole',
  weaken2: 'debole',
  weaken3: 'debole',
  expose1: 'debole',
  expose2: 'debole',
  expose3: 'debole',
}

/** L'aura che questa unità deve portare, o null. Se ha più stati vince il più
 *  grave secondo PRIORITY: una sola cornice, non cinque sovrapposte. */
export function auraFor(effects: ActiveEffect[]): Aura | null {
  if (!effects || effects.length === 0) return null

  const kinds = new Set<AuraKind>()
  for (const e of effects) {
    const id = e.statusId ?? e.kind
    const kind = AURA_BY_STATUS_ID[id]
    if (kind) kinds.add(kind)
  }
  if (kinds.size === 0) return null

  for (const kind of PRIORITY) {
    if (kinds.has(kind)) return { kind, ...AURA[kind] }
  }
  return null
}
