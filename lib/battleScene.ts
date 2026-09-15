import type { ReplayFrame } from '@/game/engine/combat/replay'
import type { ActiveEffect, LogEntry, LogFlag } from '@/types'

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
  // game/engine/status.ts:184 logs the per-turn `regen` status tick as action
  // `def?.name ?? 'Rigenerazione'` — the only status with `tickHeal` is `regen`
  // (data/statuses.ts:25, name: 'Rigenerazione'), so this action name is always
  // reachable in practice, not just a defensive fallback. Without this entry it
  // fell through to BY_FLAG's generic `heal` (normal-size number, no tick
  // styling) — visually indistinguishable from a one-off reactive heal. Mapping
  // it to 'regen' gives it the same small tick-up numeral as Fatica's 'dot',
  // which is the correct read for a recurring per-turn effect either way.
  Rigenerazione: { kind: 'regen' },
  Miasma:        { kind: 'duo-miasma',  word: 'MIASMA' },
  MuroVivente:   { kind: 'duo-muro',    word: 'MURO VIVENTE' },
  Riflesso:      { kind: 'duo-muro',    word: 'RIFLESSO' },
  Untore:        { kind: 'duo-untore',  word: 'UNTORE' },
  Ricarica:      { kind: 'cooldown' },
  Reliquia:      { kind: 'relic' },
  KO:            { kind: 'kill',        word: 'K.O.' },
}

/** Flag → scena, in ordine di PRECEDENZA: un colpo che uccide è una morte, non
 *  un critico, anche se porta entrambi i flag.
 *
 *  `dot` e `heal` restano qui perché coprono i tick generici (veleno, cure
 *  reattive) che NON passano da BY_ACTION. Ma il motore attacca proprio questi
 *  due flag anche a `Fatica` e `Rigenera` (system actions con la loro scena
 *  dedicata, 'fatigue'/'regen'): sceneEventOf controlla BY_ACTION PRIMA di
 *  questo loop così un'azione nota vince sempre sul flag generico, invece di
 *  essere inghiottita da 'dot'/'heal' e perdere la sua parola (SFINIMENTO). */
const BY_FLAG: Array<[LogFlag, SceneKind, string | undefined]> = [
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

  // BY_ACTION first: a known system action (Fatica, Rigenera, the three Duo
  // actions, Stordito, KO, …) always wins over a generic BY_FLAG match, even
  // though the engine tags several of these actions with a flag BY_FLAG also
  // knows (Fatica→['dot'], Rigenera→['heal']). Checking BY_ACTION second used
  // to let those two flags swallow the action before its own scene/word was
  // ever considered, so Fatica rendered as a plain 'dot' tick with no
  // SFINIMENTO word. Checking BY_ACTION first does not change any
  // already-correct case: `stun` and `duo` are deliberately absent from
  // BY_FLAG (Stordito/Miasma/MuroVivente/Riflesso/Untore always fell through
  // to BY_ACTION already), and KO's flags (['kill'] or ['kill','duo']) map to
  // 'kill' either way BY_ACTION and BY_FLAG agree, so a killing Duo action
  // still reads as 'kill', never as its Duo word.
  const byAction = BY_ACTION[e.action]
  if (byAction) return { ...base, kind: byAction.kind, word: byAction.word }

  for (const [flag, kind, word] of BY_FLAG) {
    if (e.flags.includes(flag)) return { ...base, kind, word }
  }

  return { ...base, kind: 'hit' }
}
