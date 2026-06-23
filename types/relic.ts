import type { House, Role } from './wizard'
import type { SynergyBonus } from './synergy'
import type { EffectSpec } from './status'

export type RelicRarity = 'comune' | 'non-comune' | 'rara' | 'epica'

export interface RelicCondition {
  house?: House
  role?: Role
  count?: number
}

export interface Relic {
  id: string
  name: string
  desc: string
  rarity: RelicRarity
  bonus?: SynergyBonus
  condition?: RelicCondition
  startOfBattle?: EffectSpec[]
  onHit?: EffectSpec[]
}

export interface ActiveRelic {
  relic: Relic
  stageObtained: number
}
