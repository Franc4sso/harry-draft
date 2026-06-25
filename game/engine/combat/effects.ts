import type { BattleUnit, EffectSpec, HookCtx, LogFlag } from '@/types'
import type { Rng } from '../rng'
import type { EventBus } from './eventBus'
import { BALANCE } from '@/data/constants'
import { STATUS_BY_ID } from '@/data/statuses'
import { absorbDamage, applyInlineEffect, applyStatus, canAttack, effectiveStats } from '../status'

export interface EffectCtx { rng: Rng; turn: number; actor: BattleUnit; target: BattleUnit; flags: LogFlag[]; bus?: EventBus }
export interface EffectResult { value?: number; dodged?: boolean }

export function computeDamage(rng: Rng, actor: BattleUnit, target: BattleUnit, power: number, flags: LogFlag[]): number {
  const c = BALANCE.combat
  const atk = effectiveStats(actor).atk
  const pen = actor.wizard.role === 'Attaccante' ? BALANCE.roles.attackerArmorPen : 0
  if (pen > 0) flags.push('pen')
  const def = effectiveStats(target).def * (1 - pen)
  let dmg = atk * power - def * c.defenseK
  dmg = Math.max(c.minDamage, dmg)
  const critChance = c.critBase + effectiveStats(actor).spd * c.critSpdScale
  if (rng.chance(critChance)) { dmg *= c.critMult; flags.push('crit') }
  return Math.round(dmg)
}

export function dodged(rng: Rng, actor: BattleUnit, target: BattleUnit): boolean {
  const c = BALANCE.combat
  const gap = effectiveStats(target).spd - effectiveStats(actor).spd
  const chance = Math.max(0, c.dodgeBase + gap * c.dodgeScale)
  return rng.chance(chance)
}

function sourceId(u: BattleUnit): string { return `${u.side}:${u.wizard.id}` }

export const EFFECT_HANDLERS: Record<EffectSpec['kind'], (ctx: EffectCtx, eff: EffectSpec) => EffectResult> = {
  damage: (ctx, eff) => {
    if (eff.kind !== 'damage') return {}
    if (eff.canDodge && dodged(ctx.rng, ctx.actor, ctx.target)) {
      ctx.flags.push('dodge'); return { value: 0, dodged: true }
    }
    if (!canAttack(ctx.actor)) return { value: 0 } // disarmed: no damage
    let dmg = computeDamage(ctx.rng, ctx.actor, ctx.target, eff.power, ctx.flags)
    if (ctx.bus) {
      const hc: HookCtx = { turn: ctx.turn, actor: ctx.actor, target: ctx.target, side: ctx.actor.side, flags: ctx.flags }
      dmg = ctx.bus.emitModifier('modifyOutgoingDamage', dmg, hc)
      dmg = Math.round(ctx.bus.emitModifier('modifyIncomingDamage', dmg, { ...hc, side: ctx.target.side }))
    }
    const residual = absorbDamage(ctx.target, dmg)
    ctx.target.hp -= residual
    return { value: dmg }
  },
  heal: (ctx, eff) => {
    if (eff.kind !== 'heal') return {}
    if (!ctx.target.alive) return { value: 0 } // never heal/revive a dead unit
    let amount = eff.amount
    if (ctx.bus) {
      // modifyHealing is gated on the HEALED unit's side (ctx.target), not the caster's.
      const hc: HookCtx = { turn: ctx.turn, actor: ctx.actor, target: ctx.target, side: ctx.target.side, flags: ctx.flags }
      amount = Math.round(ctx.bus.emitModifier('modifyHealing', amount, hc))
    }
    ctx.target.hp = Math.min(ctx.target.maxHp, ctx.target.hp + amount)
    ctx.flags.push('heal')
    return { value: amount }
  },
  shield: (ctx, eff) => {
    if (eff.kind !== 'shield') return {}
    ctx.target.statusEffects.push({
      kind: 'shield', statusId: 'shield', remaining: eff.duration ?? STATUS_BY_ID['shield']!.defaultDuration,
      stacks: 1, sourceId: sourceId(ctx.actor), absorbLeft: eff.amount,
    })
    ctx.flags.push('block')
    return {}
  },
  applyStatus: (ctx, eff) => {
    if (eff.kind !== 'applyStatus') return {}
    if (eff.chance !== undefined && !ctx.rng.chance(eff.chance)) return {}
    // NOTE: 'ally' currently collapses to ctx.target like 'enemy'; no shipped trait/spell uses 'ally' here. Revisit if one does.
    const unit = eff.target === 'self' ? ctx.actor : ctx.target
    if (eff.statusId) {
      applyStatus(unit, eff.statusId, { duration: eff.duration, sourceId: sourceId(ctx.actor) })
      const def = STATUS_BY_ID[eff.statusId]
      if (def?.kind === 'stun' || def?.kind === 'freeze') ctx.flags.push('stun')
      if (def?.kind === 'dot') ctx.flags.push('dot')
    } else if (eff.effect) {
      applyInlineEffect(unit, eff.effect, { sourceId: sourceId(ctx.actor) })
      if (eff.effect.kind === 'stun') ctx.flags.push('stun')
      if (eff.effect.kind === 'dot') ctx.flags.push('dot')
    }
    return {}
  },
}
