import type { Stat } from './spell'

export type StatusKind =
  | 'buff' | 'debuff' | 'dot' | 'stun'              // legacy (retro-compat)
  | 'freeze' | 'silence' | 'disarm' | 'regen' | 'shield'  // new
  | 'ward'                                           // spell-negation charge

export type StatusFamily = 'control' | 'dot' | 'regen' | 'shield' | 'buff' | 'debuff'
export type StatusStackPolicy = 'ignore' | 'refresh' | 'extend' | 'stack'
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
  absorb?: number
  defaultDuration: number
  stack: StatusStackPolicy
  maxStacks?: number
  priority: number
  removable: boolean
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
  | { kind: 'shield'; amount: number; duration?: number }
  | {
      kind: 'applyStatus'; target: EffectTarget; chance?: number
      statusId?: string; effect?: EffectInline; duration?: number
    }
  | { kind: 'protego'; count?: number }
