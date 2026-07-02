import type { BattleUnit, LogEntry, LogFlag, Spell } from '@/types'
import type { Rng } from '../rng'
import type { EventBus } from './eventBus'
import { consumeWard, effectiveStats, tickStatuses } from '../status'
import { EFFECT_HANDLERS } from './effects'
import { normalizeSpell } from './normalizeSpell'

export { effectiveStats, tickStatuses }

export function resolveAction(
  rng: Rng, turn: number, actor: BattleUnit, target: BattleUnit, spell: Spell,
  allies: BattleUnit[] = [], bus?: EventBus,
): LogEntry {
  const flags: LogFlag[] = []
  let value: number | undefined

  // Protego: an incoming ENEMY spell (not a basic attack) on a warded target is negated.
  if (spell.id !== 'base_attack' && actor.side !== target.side && consumeWard(target)) {
    flags.push('block')
    return {
      turn, actorId: actor.wizard.id, actorSide: actor.side, action: spell.name,
      targetId: target.wizard.id, targetSide: target.side, type: spell.type, value: 0, flags,
    }
  }

  if (spell.cooldown && spell.cooldown > 0) actor.cooldowns[spell.id] = spell.cooldown

  const dark = spell.keywords?.includes('magieOscure') ?? false
  const ctx = { rng, turn, actor, target, flags, bus, allies, dark }
  // Protego wards an ALLY (the carry), not the caster — the handler reports it so the
  // log/replay/VFX attribute the shield to whoever it actually protects.
  let entryTarget = target
  for (const eff of normalizeSpell(spell)) {
    const r = EFFECT_HANDLERS[eff.kind](ctx, eff)
    if (r.dodged) { value = 0; break }
    if (r.value !== undefined && value === undefined) value = r.value
    if (r.wardTarget) entryTarget = r.wardTarget
  }

  if (spell.type === 'Difesa' && !flags.includes('block')) flags.push('block') // log tagging only (idempotent: shield handler may have already added it)

  return {
    turn, actorId: actor.wizard.id, actorSide: actor.side, action: spell.name,
    targetId: entryTarget.wizard.id, targetSide: entryTarget.side, type: spell.type, value, flags,
  }
}
