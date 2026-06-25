import type { Trait } from '@/types'

const EXECUTE_THRESHOLD = 0.3
const EXECUTE_MULT = 1.5
const FURY_MAX_BONUS = 0.6     // up to +60% at 1 HP
const ROCK_REDUCTION = 0.2     // -20% incoming

const SIPHON_SPD = 8
const SIPHON_DURATION = 2
const BLESS_SHIELD = 25
const BLESS_DURATION = 2

const CONTROL_CHANCE = 0.18
const STUN_DURATION = 1
const SILENCE_DURATION = 2
const DISARM_DURATION = 2

const POISON_CHANCE = 0.5
const POISON_DURATION = 2
const ATTRITION_CHANCE = 0.4
const ATTRITION_DURATION = 2

const FEROCITY_DURATION = 2

const REGEN_DURATION = 3
const ANTICIPATE_SPD = 10
const ANTICIPATE_DURATION = 1

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
  {
    id: 'sifone', name: 'Sifone',
    desc: 'I suoi colpi rallentano il bersaglio (-VEL).',
    trigger: {
      kind: 'reactive', hook: 'onHit', owner: 'actor',
      effects: () => [{ kind: 'applyStatus', target: 'enemy', effect: { kind: 'debuff', stat: 'spd', amount: SIPHON_SPD, duration: SIPHON_DURATION } }],
    },
  },
  {
    id: 'benedizione', name: 'Benedizione',
    desc: 'Quando viene curato, ottiene anche uno scudo.',
    trigger: {
      kind: 'reactive', hook: 'onHeal', owner: 'actor',
      effects: () => [{ kind: 'shield', amount: BLESS_SHIELD, duration: BLESS_DURATION }],
    },
  },
  {
    id: 'pietrificazione', name: 'Pietrificazione',
    desc: 'I suoi colpi possono stordire il bersaglio.',
    trigger: {
      kind: 'reactive', hook: 'onHit', owner: 'actor',
      effects: () => [{ kind: 'applyStatus', target: 'enemy', statusId: 'stun', chance: CONTROL_CHANCE, duration: STUN_DURATION }],
    },
  },
  {
    id: 'bavaglio', name: 'Bavaglio',
    desc: 'I suoi colpi possono silenziare il bersaglio (niente incantesimi).',
    trigger: {
      kind: 'reactive', hook: 'onHit', owner: 'actor',
      effects: () => [{ kind: 'applyStatus', target: 'enemy', statusId: 'silence', chance: CONTROL_CHANCE, duration: SILENCE_DURATION }],
    },
  },
  {
    id: 'disarmo', name: 'Disarmo',
    desc: 'I suoi colpi possono disarmare il bersaglio (niente attacchi).',
    trigger: {
      kind: 'reactive', hook: 'onHit', owner: 'actor',
      effects: () => [{ kind: 'applyStatus', target: 'enemy', statusId: 'disarm', chance: CONTROL_CHANCE, duration: DISARM_DURATION }],
    },
  },
  {
    id: 'veleno', name: 'Veleno',
    desc: 'I suoi colpi avvelenano: danno nel tempo al bersaglio.',
    trigger: {
      kind: 'reactive', hook: 'onHit', owner: 'actor',
      effects: () => [{ kind: 'applyStatus', target: 'enemy', statusId: 'burn', chance: POISON_CHANCE, duration: POISON_DURATION }],
    },
  },
  {
    id: 'logoramento', name: 'Logoramento',
    desc: 'I suoi colpi rallentano il bersaglio (-VEL).',
    trigger: {
      kind: 'reactive', hook: 'onHit', owner: 'actor',
      effects: () => [{ kind: 'applyStatus', target: 'enemy', statusId: 'slow', chance: ATTRITION_CHANCE, duration: ATTRITION_DURATION }],
    },
  },
  {
    id: 'ferocia', name: 'Ferocia',
    desc: 'Ogni colpo che mette a segno aumenta il suo attacco.',
    trigger: {
      kind: 'reactive', hook: 'onHit', owner: 'actor',
      effects: () => [{ kind: 'applyStatus', target: 'self', statusId: 'atkUp', duration: FEROCITY_DURATION }],
    },
  },
  {
    id: 'rigenerazione', name: 'Rigenerazione',
    desc: 'Si rigenera un poco di vita ogni turno.',
    trigger: {
      kind: 'reactive', hook: 'onTurnStart', owner: 'actor',
      effects: () => [{ kind: 'applyStatus', target: 'self', statusId: 'regen', duration: REGEN_DURATION }],
    },
  },
  {
    id: 'anticipo', name: 'Anticipo',
    desc: 'A inizio turno guadagna velocità.',
    trigger: {
      kind: 'reactive', hook: 'onTurnStart', owner: 'actor',
      effects: () => [{ kind: 'applyStatus', target: 'self', effect: { kind: 'buff', stat: 'spd', amount: ANTICIPATE_SPD, duration: ANTICIPATE_DURATION } }],
    },
  },
]

export const TRAIT_BY_ID: Record<string, Trait> = Object.fromEntries(TRAITS.map(t => [t.id, t]))
