import type { House, Role } from './wizard'
import type { SynergyBonus } from './synergy'
import type { EffectSpec } from './status'
import type { BattleHook } from './events'

export type RelicRarity = 'comune' | 'non-comune' | 'rara' | 'epica'

export interface RelicCondition {
  house?: House
  role?: Role
  count?: number
}

export interface RelicTrigger {
  hook: BattleHook
  /** Reactive: EffectSpecs applied when the hook fires. */
  effects?: EffectSpec[]
  /** Modifier: how to transform the value flowing through a modify* hook. */
  modifier?: { mult?: number; flat?: number }
  /** Team-composition gate (reuses RelicCondition). Defaults to always-on. */
  condition?: RelicCondition
  /** onHpThreshold: fraction 0..1 below which it fires. */
  threshold?: number
}

export interface Relic {
  id: string
  name: string
  desc: string
  rarity: RelicRarity
  bonus?: SynergyBonus
  condition?: RelicCondition
  triggers?: RelicTrigger[]
}

export interface ActiveRelic {
  relic: Relic
  stageObtained: number
}
