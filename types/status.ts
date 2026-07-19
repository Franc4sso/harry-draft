import type { Stat } from './spell'
import type { Keyword } from './keyword'

export type StatusKind =
  | 'buff' | 'debuff' | 'dot' | 'stun'              // legacy (retro-compat)
  | 'freeze' | 'silence' | 'disarm' | 'regen' | 'shield'  // new
  | 'ward'                                           // spell-negation charge

export type StatusFamily = 'control' | 'dot' | 'regen' | 'shield' | 'buff' | 'debuff'
export type StatusStackPolicy = 'ignore' | 'refresh' | 'extend' | 'stack' | 'accumulate'
export type ActionGate = 'action' | 'spell' | 'attack'

export interface StatusDef {
  id: string
  name: string
  kind: StatusKind
  family: StatusFamily
  prevents?: ActionGate[]
  statMod?: { stat: Stat; amount: number; pct?: boolean }
  tickDamage?: number
  tickHeal?: number
  /** Build keyword tags (e.g. ['veleno']). */
  keywords?: Keyword[]
  /** Per-stack damage as a fraction of the target's maxHp (the "divora" component). */
  tickPctMaxHp?: number
  /** Stack count above which the %maxHp component stops growing (the guardrail). */
  tickStackCapForPct?: number
  absorb?: number
  defaultDuration: number
  stack: StatusStackPolicy
  maxStacks?: number
  priority: number
  removable: boolean
  /** When true, the status never decrements its `remaining` — it lasts the whole battle
   *  (like buffs/debuffs). Veleno uses this: once applied, it ticks every turn until the
   *  target dies or combat ends, instead of falling off after `defaultDuration`. */
  permanent?: boolean
}

export interface EffectInline {
  kind: StatusKind
  stat?: Stat
  amount?: number
  duration?: number
}

export type EffectTarget = 'enemy' | 'self' | 'ally'

export type EffectSpec =
  | { kind: 'damage'; power: number; canCrit?: boolean; canDodge?: boolean }
  | { kind: 'heal'; amount: number }
  | { kind: 'revive'; fraction: number }
  | { kind: 'shield'; amount: number; duration?: number }
  | {
      kind: 'applyStatus'; target: EffectTarget; chance?: number
      statusId?: string; effect?: EffectInline; duration?: number
      /** Per-instance DoT tick override (fire spells funnel into statusId 'burn' but keep
       *  their own per-tick damage instead of the def's flat tickDamage). Composes with
       *  magMult: the applied tick is round(tickAmount * magMult). */
      tickAmount?: number
      /** Spell-mastery magnitude multiplier (Aumento Magia). Scales the applied status's
       *  real magnitude — statMod amount, DoT tick, shield absorb — which live in the
       *  StatusDef and are otherwise read live. Absent/1 = base. Player-only. */
      magMult?: number
    }
  | { kind: 'protego'; count?: number; duration?: number }
