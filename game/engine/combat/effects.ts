import type { BattleUnit, EffectSpec, HookCtx, LogFlag } from '@/types'
import type { Rng } from '../rng'
import type { EventBus } from './eventBus'
import { BALANCE } from '@/data/constants'
import { STATUS_BY_ID } from '@/data/statuses'
import { absorbDamage, applyInlineEffect, applyStatus, canAttack, effectiveStats } from '../status'

export interface EffectCtx { rng: Rng; turn: number; actor: BattleUnit; target: BattleUnit; flags: LogFlag[]; bus?: EventBus; allies?: BattleUnit[]; dark?: boolean }
export interface EffectResult { value?: number; dodged?: boolean; wardTarget?: BattleUnit }

export function computeDamage(rng: Rng, actor: BattleUnit, target: BattleUnit, power: number, flags: LogFlag[]): number {
  const c = BALANCE.combat
  const atk = effectiveStats(actor).atk
  const pen = actor.wizard.role === 'Attaccante' ? BALANCE.roles.attackerArmorPen : 0
  if (pen > 0) flags.push('pen')
  const def = effectiveStats(target).def * (1 - pen)
  let dmg = atk * power - def * c.defenseK
  if (actor.wizard.role === 'Controllo') {
    dmg *= target.wizard.role === 'Tank' ? BALANCE.roles.controlVsTank : BALANCE.roles.controlVsBackline
  }
  dmg = Math.max(c.minDamage, dmg)
  const cb = actor.critBonus
  const critChance = c.critBase + effectiveStats(actor).spd * c.critSpdScale + (cb?.chance ?? 0)
  if (rng.chance(critChance)) { dmg *= c.critMult + (cb?.mult ?? 0); flags.push('crit') }
  return Math.round(dmg)
}

export function dodged(rng: Rng, actor: BattleUnit, target: BattleUnit): boolean {
  const c = BALANCE.combat
  const gap = effectiveStats(target).spd - effectiveStats(actor).spd
  const chance = Math.max(0, c.dodgeBase + gap * c.dodgeScale + (target.dodgeBonus ?? 0))
  return rng.chance(chance)
}

function sourceId(u: BattleUnit): string { return `${u.side}:${u.wizard.id}` }

export const EFFECT_HANDLERS: Record<EffectSpec['kind'], (ctx: EffectCtx, eff: EffectSpec) => EffectResult> = {
  damage: (ctx, eff) => {
    if (eff.kind !== 'damage') return {}
    if (eff.canDodge && !ctx.actor.alwaysHit && dodged(ctx.rng, ctx.actor, ctx.target)) {
      ctx.flags.push('dodge'); return { value: 0, dodged: true }
    }
    if (!canAttack(ctx.actor)) return { value: 0 } // disarmed: no damage
    let dmg = computeDamage(ctx.rng, ctx.actor, ctx.target, eff.power, ctx.flags)
    const ex = ctx.actor.execute
    if (ex && ctx.target.maxHp > 0 && ctx.target.hp / ctx.target.maxHp < ex.threshold) {
      dmg = Math.round(dmg * (1 + ex.bonus))
    }
    const dm = ctx.actor.darkMagic
    if (dm && ctx.dark) dmg = Math.round(dmg * (1 + dm.bonus))
    const cun = ctx.actor.cunning
    if (cun && ctx.target.maxHp > 0 && ctx.target.hp / ctx.target.maxHp < cun.threshold) {
      dmg = Math.round(dmg * (1 + cun.bonus))
    }
    // Shatter: a direct hit on a frozen target ends the freeze and amplifies THIS hit.
    const frozen = ctx.target.statusEffects.some(e => e.kind === 'freeze')
    if (frozen) {
      dmg = Math.round(dmg * BALANCE.combat.freezeShatterMult)
      ctx.target.statusEffects = ctx.target.statusEffects.filter(e => e.kind !== 'freeze')
      ctx.flags.push('shatter')
    }
    if (ctx.bus) {
      const hc: HookCtx = { turn: ctx.turn, actor: ctx.actor, target: ctx.target, side: ctx.actor.side, flags: ctx.flags }
      dmg = ctx.bus.emitModifier('modifyOutgoingDamage', dmg, hc)
      dmg = Math.round(ctx.bus.emitModifier('modifyIncomingDamage', dmg, { ...hc, side: ctx.target.side }))
    }
    const dr = ctx.target.damageReduction
    if (dr && dr > 0) dmg = Math.round(dmg * (1 - dr))
    const residual = absorbDamage(ctx.target, dmg)
    ctx.target.hp -= residual
    // Recoil: Magie Oscure carrier pays a fraction of damage DEALT (residual), lethal.
    if (dm && ctx.dark && dm.recoil > 0 && residual > 0) {
      ctx.actor.hp -= Math.round(residual * dm.recoil)
      ctx.flags.push('recoil')
    }
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
  revive: (ctx, eff) => {
    if (eff.kind !== 'revive') return {}
    if (ctx.target.alive) return { value: 0 } // revive only raises the FALLEN, never tops up the living
    const hp = Math.max(1, Math.round(ctx.target.maxHp * eff.fraction))
    ctx.target.hp = hp
    ctx.target.alive = true
    ctx.flags.push('revive')
    return { value: hp }
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
    // 'ally': ctx.target IS the resolved ally (resolveAction is called with an ally as
    // `target` for ally/team-buff spells — see simulate.ts healIntent-style targeting for
    // Cura-type spells, which already routes to the most-wounded ally). 'enemy' keeps using
    // ctx.target directly (the resolved enemy). 'self' always means the caster.
    const unit = eff.target === 'self' ? ctx.actor : ctx.target
    if (eff.statusId) {
      const maxStacks = eff.statusId === 'veleno' && ctx.actor.velenoUncapped ? Infinity : undefined
      const def = STATUS_BY_ID[eff.statusId]
      // Controllo identity: "weak vs sturdy front-line" — a Tank shrugs off half the
      // duration of a Controllo's stat debuff (control-kind statuses like stun/freeze
      // are untouched; this only softens the graded weaken/expose/slow debuffs).
      const isControlloVsTank = ctx.actor.wizard.role === 'Controllo' && unit.wizard.role === 'Tank'
      const duration = isControlloVsTank && def?.kind === 'debuff'
        ? Math.ceil((eff.duration ?? def.defaultDuration) / 2)
        : eff.duration
      applyStatus(unit, eff.statusId, { duration, sourceId: sourceId(ctx.actor), maxStacks })
      if (def?.kind === 'stun' || def?.kind === 'freeze') ctx.flags.push('stun')
      if (def?.kind === 'dot') ctx.flags.push('dot')
    } else if (eff.effect) {
      applyInlineEffect(unit, eff.effect, { sourceId: sourceId(ctx.actor) })
      if (eff.effect.kind === 'stun') ctx.flags.push('stun')
      if (eff.effect.kind === 'dot') ctx.flags.push('dot')
    }
    return {}
  },
  protego: (ctx, eff) => {
    if (eff.kind !== 'protego') return {}
    const count = eff.count ?? 1
    const pool = (ctx.allies ?? [ctx.actor]).filter(u => u.alive)
    // Protect the carry: highest effective ATK first (the team's damage source),
    // tiebreak by lowest HP fraction (most threatened), then id for determinism.
    const ranked = [...pool].sort((a, b) =>
      effectiveStats(b).atk - effectiveStats(a).atk ||
      (a.hp / a.maxHp) - (b.hp / b.maxHp) ||
      a.wizard.id.localeCompare(b.wizard.id))
    for (const u of ranked.slice(0, count)) {
      applyStatus(u, 'protego', { sourceId: `${ctx.actor.side}:${ctx.actor.wizard.id}` })
    }
    ctx.flags.push('block')
    // Report the primary warded ally so the log/replay attribute Protego to whom it
    // actually protects (the carry), not the caster.
    return { wardTarget: ranked[0] }
  },
}
