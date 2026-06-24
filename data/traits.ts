import type { Trait } from '@/types'

const EXECUTE_THRESHOLD = 0.3
const EXECUTE_MULT = 1.5
const FURY_MAX_BONUS = 0.6     // up to +60% at 1 HP
const ROCK_REDUCTION = 0.2     // -20% incoming

export const TRAITS: Trait[] = [
  {
    id: 'esecuzione', name: 'Esecuzione',
    desc: 'Infligge +50% danni ai bersagli sotto il 30% di vita.',
    trigger: {
      kind: 'modifier', hook: 'modifyOutgoingDamage', owner: 'actor',
      apply: (v, ctx) => {
        const t = ctx.target
        if (t && t.maxHp > 0 && t.hp / t.maxHp < EXECUTE_THRESHOLD) return v * EXECUTE_MULT
        return v
      },
    },
  },
  {
    id: 'furia', name: 'Furia',
    desc: 'Più è ferito, più colpisce forte (fino a +60%).',
    trigger: {
      kind: 'modifier', hook: 'modifyOutgoingDamage', owner: 'actor',
      apply: (v, ctx) => {
        const a = ctx.actor
        const missing = a.maxHp > 0 ? 1 - a.hp / a.maxHp : 0
        return v * (1 + missing * FURY_MAX_BONUS)
      },
    },
  },
  {
    id: 'roccia', name: 'Roccia',
    desc: 'Subisce il 20% di danni in meno.',
    trigger: {
      kind: 'modifier', hook: 'modifyIncomingDamage', owner: 'target',
      apply: (v) => v * (1 - ROCK_REDUCTION),
    },
  },
]

export const TRAIT_BY_ID: Record<string, Trait> = Object.fromEntries(TRAITS.map(t => [t.id, t]))
