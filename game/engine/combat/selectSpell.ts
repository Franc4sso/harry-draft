import type { BattleUnit, Spell } from '@/types'
import { SPELL_BY_ID } from '@/data/spells'
import { canCastSpell } from '../status'

export function selectSpell(unit: BattleUnit): Spell {
  if (!canCastSpell(unit)) return SPELL_BY_ID['base_attack']!
  const onCooldown = (unit.cooldowns[unit.spell.id] ?? 0) > 0
  if (onCooldown) return SPELL_BY_ID['base_attack']!
  return unit.spell
}

export function wantsHeal(actor: BattleUnit, spell: Spell): boolean {
  return spell.type === 'Cura'
}
