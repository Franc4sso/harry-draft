import type { BattleUnit, LogEntry, LogFlag, Spell } from '@/types'
import type { Rng } from '../rng'
import { effectiveStats, tickStatuses } from '../status'
import { EFFECT_HANDLERS } from './effects'
import { normalizeSpell } from './normalizeSpell'

export { effectiveStats, tickStatuses }

export function resolveAction(
  rng: Rng, turn: number, actor: BattleUnit, target: BattleUnit, spell: Spell,
): LogEntry {
  const flags: LogFlag[] = []
  let value: number | undefined

  if (spell.cooldown && spell.cooldown > 0) actor.cooldowns[spell.id] = spell.cooldown

  const ctx = { rng, turn, actor, target, flags }
  for (const eff of normalizeSpell(spell)) {
    const r = EFFECT_HANDLERS[eff.kind](ctx, eff)
    if (r.dodged) { value = 0; break }
    if (r.value !== undefined && value === undefined) value = r.value
  }

  if (spell.type === 'Difesa' && !flags.includes('block')) flags.push('block') // log tagging only (idempotent: shield handler may have already added it)

  return {
    turn, actorId: actor.wizard.id, actorSide: actor.side, action: spell.name,
    targetId: target.wizard.id, targetSide: target.side, type: spell.type, value, flags,
  }
}
