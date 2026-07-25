import type { LogEntry } from '@/types'

/**
 * CRESCENDO DI COMBATTIMENTO — il "calore" della battaglia.
 *
 * Un solo scalare `0→1` derivato dal log di combattimento: sale quando i momenti drammatici
 * si concatenano (esecuzioni, Duo, crit, colpi grossi) e decade nei frame fiacchi. Non
 * introduce effetti nuovi: AMPLIFICA i layer cinematici che `choreograph` già applica,
 * sopra il `tier` per-incantesimo.
 *
 * Puro e deterministico per costruzione — nessun `Date.now`, nessun `Math.random`, nessuna
 * dipendenza da Pixi/DOM. Poiché è funzione del solo log (già serializzato e deterministico
 * per l'anti-cheat), la PARITÀ REPLAY è garantita: stesso log → stessa sequenza di intensità.
 * Il modulo non tocca il motore: la simulazione non sa che esiste.
 *
 * Vincolo ferreo: MAI camera shake. Il crescendo si esprime solo con luce, peso, particelle,
 * tint e calore della stanza.
 */

/** Pesi e soglie — tutti tunable dal lab (`/combat-lab`). */
export interface HeatConstants {
  /** Quanto calore sopravvive a ogni frame. 0.62 ≈ due-tre beat per incandescere, due per spegnersi. */
  decay: number
  kill: number
  duo: number
  crit: number
  shatter: number
  pen: number
  /** Contributo massimo del `value` di un colpo, normalizzato sul massimo mobile del log. */
  value: number
  /** Durata massima (ms) dell'hit-stop all'apice. 0 = SPENTO (default, vedi nota sotto). */
  hitStopMax: number
}

/**
 * L'hit-stop è implementato ma spento di default (`hitStopMax: 0`): il crescendo di base
 * regge su bloom, peso e dim: il micro-freeze è la ciliegina, da accendere e validare a
 * occhio nel lab. Alzare questa costante lo attiva senza altre modifiche.
 */
export const HEAT: HeatConstants = {
  decay: 0.62,
  kill: 0.45,
  duo: 0.4,
  crit: 0.22,
  shatter: 0.12,
  pen: 0.12,
  value: 0.15,
  hitStopMax: 0,
}

export interface HeatState {
  /** Intensità corrente, già in [0,1]. */
  heat: number
  /** Massimo di `value` visto finora nel log — normalizza i colpi grossi senza dipendere da
   *  `maxHp` (assente in `LogEntry`). Ricalcolabile dal prefisso → resta puro. */
  valueMax: number
}

export const HEAT_ZERO: HeatState = { heat: 0, valueMax: 0 }

const clamp01 = (n: number): number => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0)

/** Quanto scalda UN frame. Le righe di sistema e i "fizzle" (schiva/parata/attesa) valgono 0:
 *  non raffreddano attivamente, lasciano semplicemente decadere. */
function beatScore(entry: LogEntry, valueMax: number, k: HeatConstants): number {
  if (entry.type === 'system') return 0
  const f = entry.flags ?? []
  if (f.includes('dodge') || f.includes('block') || f.includes('wait')) return 0

  let s = 0
  if (f.includes('kill')) s += k.kill
  if (f.includes('duo')) s += k.duo
  if (f.includes('crit')) s += k.crit
  if (f.includes('shatter')) s += k.shatter
  if (f.includes('pen')) s += k.pen

  const v = entry.value ?? 0
  if (v > 0 && valueMax > 0) s += k.value * Math.min(1, v / valueMax)
  return s
}

/** Un passo O(1): stato precedente + entry → nuovo stato. Puro. `null` = frame senza azione
 *  (lo stato pre-combattimento): decade soltanto. */
export function heatNext(prev: HeatState, entry: LogEntry | null, k: HeatConstants = HEAT): HeatState {
  if (!entry) return { heat: clamp01(prev.heat * k.decay), valueMax: prev.valueMax }
  const valueMax = Math.max(prev.valueMax, entry.value ?? 0)
  return {
    heat: clamp01(prev.heat * k.decay + beatScore(entry, valueMax, k)),
    valueMax,
  }
}

/** Il calore a ogni indice del log: `heatNext` ripiegato su tutto il prefisso, in una passata. */
export function heatSeries(entries: readonly (LogEntry | null)[], k: HeatConstants = HEAT): number[] {
  const out: number[] = []
  let s = HEAT_ZERO
  for (const entry of entries) {
    s = heatNext(s, entry, k)
    out.push(s.heat)
  }
  return out
}

/**
 * Intensità 0..1 al frame `index` = fold di `heatNext` sul prefisso `[0..index]`.
 * Robusta a seek/rewind del replay: non dipende da come ci si è arrivati, solo da dove si è.
 */
export function heatAt(entries: readonly (LogEntry | null)[], index: number, k: HeatConstants = HEAT): number {
  const last = Math.min(index, entries.length - 1)
  let s = HEAT_ZERO
  for (let i = 0; i <= last; i++) s = heatNext(s, entries[i] ?? null, k)
  return s.heat
}

/** Moltiplicatori/pesi derivati dall'intensità — tutti clampati, mai NaN. */
export interface HeatAmp {
  /** Moltiplicatore della forza del bloom. */
  bloom: number
  /** Moltiplicatore della scala degli anelli d'urto. */
  shock: number
  /** Moltiplicatore del conteggio particelle (il cap duro vive in `choreograph`). */
  particles: number
  /** Moltiplicatore del peso di tint/wash. */
  tint: number
  /** Profondità del dim "slow-mo" all'impatto, 0..1. */
  dim: number
  /** Opacità del calore della stanza, tetto 0.12 — deve restare sotto la leggibilità. */
  room: number
  /** Micro-freeze all'impatto in ms. 0 quando `hitStopMax` è 0 (default). */
  hitStopMs: number
}

/** Tetti del mapping: nessun layer può superarli, per performance e leggibilità. */
const AMP = { bloom: 0.9, shock: 0.5, particles: 1.0, tint: 0.8, room: 0.12 } as const

/**
 * Mapping puro intensità → parametri. Additivo/moltiplicativo SOPRA il tier: nessun effetto è
 * gated dall'intensità — un ultimate in fase calma spara comunque il suo set-piece, un colpo
 * base durante una streak incandescente si accende comunque.
 */
export function heatAmp(intensity: number, k: HeatConstants = HEAT): HeatAmp {
  const i = clamp01(intensity)
  return {
    bloom: 1 + AMP.bloom * i,
    shock: 1 + AMP.shock * i,
    particles: 1 + AMP.particles * i,
    tint: 1 + AMP.tint * i,
    // Il dim entra solo nella metà alta: sotto non deve sporcare uno scambio calmo.
    dim: clamp01((i - 0.45) / 0.55),
    room: AMP.room * i * i, // quadratico: la stanza si accende tardi, all'apice
    hitStopMs: Math.max(0, k.hitStopMax) * i,
  }
}
