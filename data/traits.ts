import type { Trait } from '@/types'

const EXECUTE_THRESHOLD = 0.3
const EXECUTE_MULT = 1.5
const FURY_MAX_BONUS = 0.6     // up to +60% at 1 HP
const ROCK_REDUCTION = 0.2     // -20% incoming

const BLESS_SHIELD = 25
const BLESS_DURATION = 2

const CONTROL_CHANCE = 0.3
const STUN_DURATION = 1
const SILENCE_DURATION = 2
const DISARM_DURATION = 2

const ATTRITION_CHANCE = 0.4
const ATTRITION_DURATION = 2

const FEROCITY_DURATION = 2

const REGEN_DURATION = 3
const ANTICIPATE_SPD = 10
const ANTICIPATE_DURATION = 1

const CRESCENDO_ATK = 6
const CRESCENDO_DURATION = 3
const VENDETTA_ATK = 30
const VENDETTA_DURATION = 3

export const TRAITS: Trait[] = [
  {
    id: 'esecuzione', name: 'Esecuzione',
    desc: 'Infligge +50% danni ai bersagli sotto il 30% di vita.',
    epithet: { m: 'il Carnefice', f: 'la Carnefice' },
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
    epithet: { m: 'il Furioso', f: 'la Furiosa' },
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
    epithet: { m: "l'Incrollabile", f: "l'Incrollabile" },
    trigger: {
      kind: 'modifier', hook: 'modifyIncomingDamage', owner: 'target',
      apply: (v) => v * (1 - ROCK_REDUCTION),
    },
  },
  {
    id: 'sifone', name: 'Sifone',
    desc: 'I suoi colpi rallentano il bersaglio (-VEL%).',
    epithet: { m: 'il Sanguisuga', f: 'la Sanguisuga' },
    trigger: {
      kind: 'reactive', hook: 'onHit', owner: 'actor',
      effects: () => [{ kind: 'applyStatus', target: 'enemy', statusId: 'slow1' }],
    },
  },
  {
    id: 'benedizione', name: 'Benedizione',
    desc: 'Quando viene curato, ottiene anche uno scudo.',
    epithet: { m: 'il Benedetto', f: 'la Benedetta' },
    trigger: {
      kind: 'reactive', hook: 'onHeal', owner: 'actor',
      effects: () => [{ kind: 'shield', amount: BLESS_SHIELD, duration: BLESS_DURATION }],
    },
  },
  {
    id: 'pietrificazione', name: 'Pietrificazione',
    desc: 'I suoi colpi possono stordire il bersaglio.',
    epithet: { m: 'il Pietrificante', f: 'la Pietrificante' },
    trigger: {
      kind: 'reactive', hook: 'onHit', owner: 'actor',
      effects: () => [{ kind: 'applyStatus', target: 'enemy', statusId: 'stun', chance: CONTROL_CHANCE, duration: STUN_DURATION }],
    },
  },
  {
    id: 'bavaglio', name: 'Bavaglio',
    desc: 'I suoi colpi possono silenziare il bersaglio (niente incantesimi).',
    epithet: { m: 'il Silenziatore', f: 'la Silenziatrice' },
    trigger: {
      kind: 'reactive', hook: 'onHit', owner: 'actor',
      effects: () => [{ kind: 'applyStatus', target: 'enemy', statusId: 'silence', chance: CONTROL_CHANCE, duration: SILENCE_DURATION }],
    },
  },
  {
    id: 'disarmo', name: 'Disarmo',
    desc: 'I suoi colpi possono disarmare il bersaglio (niente attacchi).',
    epithet: { m: 'il Disarmante', f: 'la Disarmante' },
    trigger: {
      kind: 'reactive', hook: 'onHit', owner: 'actor',
      effects: () => [{ kind: 'applyStatus', target: 'enemy', statusId: 'disarm', chance: CONTROL_CHANCE, duration: DISARM_DURATION }],
    },
  },
  {
    id: 'logoramento', name: 'Logoramento',
    desc: 'I suoi colpi indeboliscono il bersaglio (-ATT%).',
    epithet: { m: 'lo Sfiancante', f: 'la Sfiancante' },
    trigger: {
      kind: 'reactive', hook: 'onHit', owner: 'actor',
      effects: () => [{ kind: 'applyStatus', target: 'enemy', statusId: 'weaken2', chance: ATTRITION_CHANCE, duration: ATTRITION_DURATION }],
    },
  },
  {
    id: 'ferocia', name: 'Ferocia',
    desc: 'Mettendo a segno un colpo rinforza il suo attacco.',
    epithet: { m: 'il Feroce', f: 'la Feroce' },
    trigger: {
      kind: 'reactive', hook: 'onHit', owner: 'actor',
      effects: () => [{ kind: 'applyStatus', target: 'self', statusId: 'atkUp', duration: FEROCITY_DURATION }],
    },
  },
  {
    id: 'rigenerazione', name: 'Rigenerazione',
    desc: 'Si rigenera un poco di vita ogni turno.',
    epithet: { m: 'il Rigenerante', f: 'la Rigenerante' },
    trigger: {
      kind: 'reactive', hook: 'onTurnStart', owner: 'actor',
      effects: () => [{ kind: 'applyStatus', target: 'self', statusId: 'regen', duration: REGEN_DURATION }],
    },
  },
  {
    id: 'anticipo', name: 'Anticipo',
    desc: 'A inizio turno guadagna velocità.',
    epithet: { m: 'il Fulmineo', f: 'la Fulminea' },
    trigger: {
      kind: 'reactive', hook: 'onTurnStart', owner: 'actor',
      effects: () => [{ kind: 'applyStatus', target: 'self', effect: { kind: 'buff', stat: 'spd', amount: ANTICIPATE_SPD, duration: ANTICIPATE_DURATION } }],
    },
  },
  {
    id: 'crescendo', name: 'Crescendo',
    desc: 'Più dura lo scontro, più diventa forte.',
    epithet: { m: "l'Inarrestabile", f: "l'Inarrestabile" },
    trigger: {
      kind: 'reactive', hook: 'onTurnStart', owner: 'actor',
      effects: () => [{ kind: 'applyStatus', target: 'self', effect: { kind: 'buff', stat: 'atk', amount: CRESCENDO_ATK, duration: CRESCENDO_DURATION } }],
    },
  },
  {
    id: 'vendetta', name: 'Vendetta',
    desc: 'Quando un alleato cade, si infuria (+ATT).',
    epithet: { m: 'il Vendicatore', f: 'la Vendicatrice' },
    trigger: {
      kind: 'reactive', hook: 'onAllyDeath', owner: 'actor',
      effects: () => [{ kind: 'applyStatus', target: 'self', effect: { kind: 'buff', stat: 'atk', amount: VENDETTA_ATK, duration: VENDETTA_DURATION } }],
    },
  },
  {
    id: 'frantumazione', name: 'Frantumazione',
    desc: 'I suoi colpi aprono la difesa del bersaglio (-DIF%).',
    epithet: { m: 'il Devastatore', f: 'la Devastatrice' },
    trigger: {
      kind: 'reactive', hook: 'onHit', owner: 'actor',
      effects: () => [{ kind: 'applyStatus', target: 'enemy', statusId: 'expose2', chance: 0.5, duration: 2 }],
    },
  },
  {
    id: 'gelo', name: 'Gelo',
    desc: 'I suoi colpi possono congelare il bersaglio (salta il turno).',
    epithet: { m: 'il Glaciale', f: 'la Glaciale' },
    trigger: {
      kind: 'reactive', hook: 'onHit', owner: 'actor',
      effects: () => [{ kind: 'applyStatus', target: 'enemy', statusId: 'freeze', chance: 0.25, duration: 2 }],
    },
  },
]

export const TRAIT_BY_ID: Record<string, Trait> = Object.fromEntries(TRAITS.map(t => [t.id, t]))

/** The trait ids eligible for a shiny draft roll (all of them). */
export const SHINY_TRAIT_IDS: string[] = TRAITS.map(t => t.id)
