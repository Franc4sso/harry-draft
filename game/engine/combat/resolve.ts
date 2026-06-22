import type { BattleUnit, LogEntry, LogFlag, Spell } from '@/types'
import type { Rng } from '../rng'
import { BALANCE } from '@/data/constants'
import { effectiveStats, tickStatuses } from '../status'
export { effectiveStats, tickStatuses }

function computeDamage(rng: Rng, actor: BattleUnit, target: BattleUnit, spell: Spell, flags: LogFlag[]): number {
  const c = BALANCE.combat
  const atk = effectiveStats(actor).atk
  const def = effectiveStats(target).def
  const power = spell.power ?? c.baseAttackMult
  let dmg = atk * power - def * c.defenseK
  dmg = Math.max(c.minDamage, dmg)
  const critChance = c.critBase + effectiveStats(actor).spd * c.critSpdScale
  if (rng.chance(critChance)) { dmg *= c.critMult; flags.push('crit') }
  return Math.round(dmg)
}

function dodged(rng: Rng, actor: BattleUnit, target: BattleUnit): boolean {
  const c = BALANCE.combat
  const gap = effectiveStats(target).spd - effectiveStats(actor).spd
  const chance = Math.max(0, c.dodgeBase + gap * c.dodgeScale)
  return rng.chance(chance)
}

export function resolveAction(
  rng: Rng, turn: number, actor: BattleUnit, target: BattleUnit, spell: Spell,
): LogEntry {
  const flags: LogFlag[] = []
  let value: number | undefined
  const type = spell.type

  if (spell.cooldown && spell.cooldown > 0) actor.cooldowns[spell.id] = spell.cooldown

  if (spell.type === 'Cura') {
    const heal = spell.heal ?? 0
    target.hp = Math.min(target.maxHp, target.hp + heal)
    value = heal; flags.push('heal')
  } else if (spell.type === 'Attacco' || spell.type === 'Controllo') {
    const isAttack = (spell.power ?? 0) > 0
    if (isAttack && dodged(rng, actor, target)) {
      flags.push('dodge'); value = 0
    } else {
      if (isAttack) {
        const dmg = computeDamage(rng, actor, target, spell, flags)
        target.hp -= dmg; value = dmg
      }
      for (const e of spell.effects ?? []) {
        if (e.kind === 'stun') flags.push('stun')
        if (e.kind === 'dot') flags.push('dot')
        target.statusEffects.push({ kind: e.kind, stat: e.stat, amount: e.amount, remaining: e.duration ?? 1 })
      }
    }
  } else {
    // Difesa: buff self/ally (target is actor or ally)
    for (const e of spell.effects ?? []) {
      target.statusEffects.push({ kind: e.kind, stat: e.stat, amount: e.amount, remaining: e.duration ?? 1 })
    }
    flags.push('block')
  }

  return {
    turn, actorId: actor.wizard.id, actorSide: actor.side, action: spell.name,
    targetId: target.wizard.id, targetSide: target.side, type, value, flags,
  }
}

