import type { ReplayFrame, ReplayUnit } from '@/game/engine/combat/replay'
import { unitKey } from '@/game/engine/combat/replay'
import type { Side } from '@/types'

/** Costanti veleno (mirror di data/statuses.ts:24 — NON importate dal motore per tenere
 *  questo modulo puro-UI; se cambiano lì, aggiornare qui). */
const VENOM_TICK = 4
const VENOM_PCT_MAXHP = 0.005
const VENOM_PCT_STACK_CAP = 8

/** Unità vive (hp>0) su un side, dal frame. `alive` non è nel frame → derivato. */
export function livingCount(frame: ReplayFrame, units: ReplayUnit[], side: Side): number {
  return units.filter(u => u.side === side && (frame.hp[u.key] ?? 0) > 0).length
}

/** Stack di veleno su un'unità in questo frame (0 se non avvelenata). */
export function venomOf(frame: ReplayFrame, unit: ReplayUnit): number {
  const effs = frame.statusEffects[unit.key] ?? []
  const v = effs.find(e => e.statusId === 'veleno')
  return v?.stacks ?? 0
}

/** Stima del danno-veleno per turno: flat + termine percentuale (capato a 8 stack). Arrotondato.
 *  È una STIMA UI: velenoMult (reliquie) e l'amplificazione Cancrena sono engine-side e non
 *  entrano qui — il meter la marca come stima, non come verità del motore. */
export function venomPerTurn(stacks: number, maxHp: number): number {
  if (stacks <= 0) return 0
  const flat = VENOM_TICK * stacks
  const pct = Math.min(stacks, VENOM_PCT_STACK_CAP) * VENOM_PCT_MAXHP * maxHp
  return Math.round(flat + pct)
}

/** Regola ibrida di aggancio del meter: fra i nemici VIVI, il più avvelenato (a parità, HP più
 *  basso). Se nessun nemico vivo ha veleno, il bersaglio nemico vivo dell'azione corrente. Senò null. */
export function focusEnemy(frame: ReplayFrame, units: ReplayUnit[], playerSide: Side): ReplayUnit | null {
  const enemySide: Side = playerSide === 'left' ? 'right' : 'left'
  const livingEnemies = units.filter(u => u.side === enemySide && (frame.hp[u.key] ?? 0) > 0)
  const poisoned = livingEnemies
    .map(u => ({ u, v: venomOf(frame, u), hp: frame.hp[u.key] ?? 0 }))
    .filter(x => x.v > 0)
  if (poisoned.length) {
    poisoned.sort((a, b) => (b.v - a.v) || (a.hp - b.hp))
    return poisoned[0]!.u
  }
  // nessun veleno → bersaglio nemico vivo dell'azione
  const e = frame.entry
  if (e?.targetSide === enemySide && e.targetId) {
    const key = unitKey(enemySide, e.targetId)
    const target = livingEnemies.find(u => u.key === key)
    if (target) return target
  }
  return null
}

/** Turni stimati alla morte per veleno; null se non c'è danno/turno. */
export function turnsToDie(hp: number, perTurn: number): number | null {
  if (perTurn <= 0) return null
  return Math.ceil(hp / perTurn)
}
