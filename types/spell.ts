import type { EffectSpec, EffectTarget } from './status'
import type { Keyword } from './keyword'

export type SpellType = 'Attacco' | 'Difesa' | 'Cura' | 'Controllo'
export type Stat = 'hp' | 'atk' | 'def' | 'spd'

export interface SpellEffect {
  kind: 'buff' | 'debuff' | 'dot' | 'stun'
  stat?: Stat
  amount?: number
  duration?: number
}

export interface Spell {
  id: string
  name: string
  desc: string
  type: SpellType
  power?: number
  heal?: number
  hitChance: number
  cooldown?: number
  effects?: SpellEffect[]
  spec?: EffectSpec[]
  target?: EffectTarget
  priority?: number
  keywords?: Keyword[]
}
