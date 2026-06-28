import type { BattleUnit, Spell } from '@/types'
import { SPELL_BY_ID } from '@/data/spells'
import { canCastSpell } from '../status'

/** WAIT semantics: a unit whose own spell is merely on cooldown does nothing
 *  this turn (returns null). base_attack is only the silence/disarm fallback. */
export function selectSpell(unit: BattleUnit): Spell | null {
  if (!canCastSpell(unit)) return SPELL_BY_ID['base_attack']!
  const onCooldown = (unit.cooldowns[unit.spell.id] ?? 0) > 0
  if (onCooldown) return null
  return unit.spell
}

export function wantsHeal(actor: BattleUnit, spell: Spell): boolean {
  return spell.type === 'Cura'
}
