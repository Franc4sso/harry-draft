import type { House, Role } from './wizard'
import type { Stat } from './spell'

export interface SynergyRequirement {
  house?: House
  role?: Role
  count?: number
  ids?: string[]
  tag?: string
}

export type SynergyBonus = Partial<Record<Stat, number>> & {
  allPct?: number
  regen?: number
}

export interface Synergy {
  id: string
  name: string
  kind: 'house' | 'role' | 'group' | 'origin'
  /** Mutually-exclusive tier group, e.g. 'house:Grifondoro'. Only the highest active tier in a family applies. Undefined = standalone (groups). */
  family?: string
  requires: SynergyRequirement
  bonus: SynergyBonus
}

export interface ActiveSynergy { synergy: Synergy; memberIds: string[] }
