import type { BattleUnit } from '@/types'
import { effectiveStats } from '../status'

/** "Hard" control that disables a unit — the family that suppresses a Tank's taunt and
 *  that Supporto's Tenacia resists. Excludes disarm and graded slows/debuffs. */
export const HARD_CONTROL_KINDS = new Set(['stun', 'freeze', 'silence'])

export function countHardControl(u: BattleUnit): number {
  return u.statusEffects.filter(e => HARD_CONTROL_KINDS.has(e.kind)).length
}

export function isUnderHardControl(u: BattleUnit): boolean {
  return u.statusEffects.some(e => HARD_CONTROL_KINDS.has(e.kind))
}

/** Remove ONE hard-control effect from the most-disabled living ally (tiebreak: carry, then
 *  id). Returns the ally cleansed, or undefined if none is hard-controlled. Mutates in place. */
export function cleanseOneControl(allies: BattleUnit[]): BattleUnit | undefined {
  const disabled = allies.filter(a => a.alive && countHardControl(a) > 0)
  if (!disabled.length) return undefined
  disabled.sort((a, b) =>
    countHardControl(b) - countHardControl(a) ||
    effectiveStats(b).atk - effectiveStats(a).atk ||
    a.wizard.id.localeCompare(b.wizard.id))
  const target = disabled[0]!
  const idx = target.statusEffects.findIndex(e => HARD_CONTROL_KINDS.has(e.kind))
  if (idx >= 0) target.statusEffects.splice(idx, 1)
  return target
}

/** Set `controlResist` on every unit: true iff its side has a live Supporto (Tenacia aura).
 *  Call once per turn so the aura drops when the last Supporto dies. */
export function applyTenaciaAura(L: BattleUnit[], R: BattleUnit[]): void {
  const has = (side: BattleUnit[]) => side.some(u => u.alive && u.wizard.role === 'Supporto')
  const l = has(L), r = has(R)
  for (const u of L) u.controlResist = l
  for (const u of R) u.controlResist = r
}
