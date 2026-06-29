import type { House, Role } from './wizard'
import type { SynergyBonus } from './synergy'
import type { EffectSpec } from './status'
import type { BattleHook } from './events'
import type { Keyword } from './keyword'

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
  /** Build keyword tags. */
  keywords?: Keyword[]
  /** Team-level multiplier added to a keyword's damage (e.g. { veleno: 0.5 } = +50%). */
  keywordMult?: Partial<Record<Keyword, number>>
  /** Grants the whole team an execute: +bonus damage to targets below `threshold` HP fraction. */
  grantsExecute?: { threshold: number; bonus: number }
  /** Grants the team a regen-overflow → shield conversion (Scudi-Rigen archetype): `rate` of
   *  the regen tick's overflow-above-maxHp becomes shield. Stacked/scaled via teamShieldConvert. */
  grantsShieldConvert?: { rate: number }
  /** Grants a single ASSIGNED carrier (ActiveRelic.assignedTo) the Magie Oscure amplify + recoil:
   *  +bonus dmg on dark spells, recoil = that fraction of damage DEALT back to the caster (lethal). */
  grantsDarkMagic?: { bonus: number; recoil: number }
  /** When true, this relic is assigned to ONE wizard at draft time (see ActiveRelic.assignedTo). */
  assignable?: boolean
}

export interface ActiveRelic {
  relic: Relic
  stageObtained: number
  assignedTo?: string   // wizardId of the carrier (for `assignable` relics); undefined = unassigned
}
