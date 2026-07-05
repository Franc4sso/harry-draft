import type { BattleUnit, Role } from '@/types'
import { BALANCE } from '@/data/constants'

/** The counter cycle: each role deals bonus damage to the role it preys on. */
export const ROLE_PREY: Record<Role, Role> = {
  Tank: 'Attaccante', Attaccante: 'Supporto', Supporto: 'Controllo', Controllo: 'Tank',
}

/** Damage multiplier for a role matchup: ×(1+matchupBonus) vs your prey, ×1 otherwise. */
export function roleMult(attacker: Role, defender: Role): number {
  return 1 + (ROLE_PREY[attacker] === defender ? BALANCE.roles.matchupBonus : 0)
}

/** "Hard" control that disables a unit — the family that suppresses a Tank's taunt and
 *  that Supporto's Tenacia resists. Excludes disarm and graded slows/debuffs. */
export const HARD_CONTROL_KINDS = new Set(['stun', 'freeze', 'silence'])

export function countHardControl(u: BattleUnit): number {
  return u.statusEffects.filter(e => HARD_CONTROL_KINDS.has(e.kind)).length
}

export function isUnderHardControl(u: BattleUnit): boolean {
  return u.statusEffects.some(e => HARD_CONTROL_KINDS.has(e.kind))
}
