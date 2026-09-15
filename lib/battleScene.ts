import type { ReplayFrame } from '@/game/engine/combat/replay'
import type { ActiveEffect, LogEntry } from '@/types'

export type SceneKind =
  | 'hit' | 'crit' | 'dodge' | 'block' | 'pen' | 'heal' | 'kill' | 'revive'
  | 'skip' | 'dot' | 'regen' | 'fatigue' | 'purify' | 'recoil' | 'shatter'
  | 'duo-miasma' | 'duo-muro' | 'duo-untore' | 'cooldown' | 'relic' | 'none'

export interface SceneEvent {
  kind: SceneKind
  actorKey?: string
  targetKey?: string
  /** Danno o cura, già in valore assoluto. */
  amount?: number
  /** Parola da far esplodere al centro (CRITICO, SALTA, K.O., MIASMA…). */
  word?: string
  /** Stati COMPARSI su un'unità in questo frame: unitKey -> kind[]. */
  gained: Record<string, string[]>
  /** Stati SPARITI in questo frame: unitKey -> kind[]. */
  lost: Record<string, string[]>
}

/** Azioni di sistema del motore (simulate.ts) → scena. Le tre di Duo hanno una
 *  scena propria perché sono i momenti in cui la build del giocatore si vede
 *  lavorare: meritano il nome esploso al centro, non una riga di registro. */
const BY_ACTION: Record<string, { kind: SceneKind; word?: string }> = {
  Stordito:      { kind: 'skip',        word: 'SALTA' },
  Fatica:        { kind: 'fatigue',     word: 'SFINIMENTO' },
  Purificazione: { kind: 'purify',      word: 'PURIFICATO' },
  Rigenera:      { kind: 'regen' },
  Miasma:        { kind: 'duo-miasma',  word: 'MIASMA' },
  MuroVivente:   { kind: 'duo-muro',    word: 'MURO VIVENTE' },
  Riflesso:      { kind: 'duo-muro',    word: 'RIFLESSO' },
  Untore:        { kind: 'duo-untore',  word: 'UNTORE' },
  Ricarica:      { kind: 'cooldown' },
  Reliquia:      { kind: 'relic' },
  KO:            { kind: 'kill',        word: 'K.O.' },
}

/** Flag → scena, in ordine di PRECEDENZA: un colpo che uccide è una morte, non
 *  un critico, anche se porta entrambi i flag. */
const BY_FLAG: Array<[string, SceneKind, string | undefined]> = [
  ['kill',    'kill',    'K.O.'],
  ['revive',  'revive',  'RIANIMATO'],
  ['dodge',   'dodge',   'SCHIVA'],
  ['block',   'block',   undefined],
  ['recoil',  'recoil',  'CONTRACCOLPO'],
  ['pen',     'pen',     'ARMATURA FORATA'],
  ['shatter', 'shatter', 'SCUDO INFRANTO'],
  ['crit',    'crit',    'CRITICO'],
  ['dot',     'dot',     undefined],
  ['heal',    'heal',    undefined],
]

function kindsOf(list: ActiveEffect[] | undefined): string[] {
  return (list ?? []).map(e => e.statusId ?? e.kind)
}

/** Stati comparsi e spariti fra due frame. È ciò che permette di animare la
 *  comparsa del veleno o la fine di un congelamento senza che il motore debba
 *  emettere un evento dedicato: la differenza fra due fotogrammi basta. */
function diffStatuses(now: ReplayFrame, prev?: ReplayFrame) {
  const gained: Record<string, string[]> = {}
  const lost: Record<string, string[]> = {}
  const keys = new Set([...Object.keys(now.statusEffects ?? {}), ...Object.keys(prev?.statusEffects ?? {})])
  for (const k of keys) {
    const a = kindsOf(prev?.statusEffects?.[k])
    const b = kindsOf(now.statusEffects?.[k])
    const g = b.filter(x => !a.includes(x))
    const l = a.filter(x => !b.includes(x))
    if (g.length) gained[k] = g
    if (l.length) lost[k] = l
  }
  return { gained, lost }
}

/**
 * Traduce un fotogramma del replay nell'evento che la scena deve mostrare.
 *
 * Pura: stesso frame, stessa scena. Non legge stato di riproduzione, quindi
 * riavvolgere o saltare avanti dà sempre lo stesso risultato.
 */
export function sceneEventOf(frame: ReplayFrame, prev?: ReplayFrame): SceneEvent {
  const { gained, lost } = diffStatuses(frame, prev)
  const e: LogEntry | null = frame.entry
  if (!e) return { kind: 'none', gained, lost }

  const base = {
    actorKey: e.actorSide && e.actorId ? `${e.actorSide}:${e.actorId}` : undefined,
    targetKey: e.targetSide && e.targetId ? `${e.targetSide}:${e.targetId}` : undefined,
    amount: e.value !== undefined ? Math.abs(e.value) : undefined,
    gained, lost,
  }

  for (const [flag, kind, word] of BY_FLAG) {
    if (e.flags.includes(flag as never)) return { ...base, kind, word }
  }
  const byAction = BY_ACTION[e.action]
  if (byAction) return { ...base, kind: byAction.kind, word: byAction.word }

  return { ...base, kind: 'hit' }
}
