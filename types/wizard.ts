import type { Stat } from './spell'

export type House = 'Grifondoro' | 'Serpeverde' | 'Corvonero' | 'Tassorosso'
export type Role = 'Attaccante' | 'Tank' | 'Supporto' | 'Controllo'
export type Tier = 1 | 2 | 3 | 4

export type Range = readonly [number, number]
export interface StatRanges { hp: Range; atk: Range; def: Range; spd: Range }
export type Stats = Record<Stat, number>

export interface Wizard {
  id: string
  name: string
  house: House
  role: Role
  tier: Tier
  gender: 'm' | 'f'
  ranges: StatRanges
  spellPool: string[]
  tags?: string[]
}
