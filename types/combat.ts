import type { Spell, SpellType, Stat } from './spell'
import type { StatusKind } from './status'
import type { Stats, Wizard } from './wizard'

export interface GrowthChoice {
  atLevel: number
  kind: 'atk' | 'def' | 'spd' | 'hp'
}

export interface DraftedWizard {
  wizard: Wizard
  stats: Stats
  maxHp: number
  spell: Spell
  /** Current HP carried across battles in a run. Absent = full (treated as maxHp). */
  currentHp?: number
  /** Rare draft "shiny" nature: grants one trait + a name epithet. Player-only. */
  shiny?: { traitId: string }
  /** Run progression (player wizards only; absent on enemy teams → treated as level 1). */
  level?: number
  exp?: number
  /** Magic mastery earned at "Aumento Magia" nodes (player-only). Scales the equipped
   *  spell's power/heal; absent = level 1 (no bonus). Carries across spell swaps. */
  spellLevel?: number
  recruitedVia?: string
  growthChoices?: GrowthChoice[]
}

export interface ActiveEffect {
  kind: StatusKind
  stat?: Stat
  amount?: number
  remaining: number
  statusId?: string
  stacks?: number
  sourceId?: string
  absorbLeft?: number
}

export type Side = 'left' | 'right'

export interface BattleUnit extends DraftedWizard {
  side: Side
  hp: number
  cooldowns: Record<string, number>
  statusEffects: ActiveEffect[]
  buffedStats: Stats
  alive: boolean
  /** True when this unit's side has the Tossicità synergy active → veleno it applies ignores maxStacks. */
  velenoUncapped?: boolean
  /** This unit's side execute (from relics/Spietatezza): +bonus dmg to targets below `threshold` HP fraction. */
  execute?: { threshold: number; bonus: number }
  /** This unit ignores the target's dodge roll on canDodge effects (Mira Infallibile — anti-Grifondoro). */
  alwaysHit?: boolean
  /** This unit's side shield-conversion (from relics/Bastione): `rate` of regen overflow → shield. */
  shieldConvert?: { rate: number }
  /** This unit's Magie Oscure effect (from an assigned Marchio Nero / the Oscurità synergy):
   *  +bonus dmg on dark spells, recoil fraction of damage dealt back to self (lethal). */
  darkMagic?: { bonus: number; recoil: number }
  /** Grifondoro house (courage): extra dodge chance added in `dodged()` when this unit is attacked. */
  dodgeBonus?: number
  /** Corvonero house (intelligence): added crit chance + added crit multiplier in `computeDamage`. */
  critBonus?: { chance: number; mult: number }
  /** Tassorosso house (loyalty): fraction of incoming damage reduced when this unit is the target. */
  damageReduction?: number
  /** Serpeverde house (cunning): +`bonus` damage dealt to a target below `threshold` HP fraction. */
  cunning?: { threshold: number; bonus: number }
  // --- House Trio stamps (player-only; see game/engine/trios.ts) ---
  /** Serpeverde Opportunista: +`bonus` fraction to the first hit on a full-HP enemy. */
  firstStrike?: { bonus: number }
  /** Corvonero Analisi: on every hit this unit lands, apply `exposeId` (def debuff) to the target. */
  analysis?: { exposeId: 'expose1' | 'expose2' }
  /** Tassorosso Tenacia: hostile statuses this unit applies last +`statusDurationBonus` turns. */
  statusDurationBonus?: number
  /** Grifondoro Slancio: this unit's spell cooldowns are reduced by `cooldownReduction` (min 1). */
  cooldownReduction?: number
  /** Bellatrix signature: this unit ignores the enemy Tank's taunt bonus in threat scoring (targets backline). */
  ignoresTaunt?: boolean
  /** Set each turn: true while this unit's side has a live Supporto (Tenacia aura). */
  controlResist?: boolean
  // --- Duo stamps (player-only; see game/engine/duoEffects/stamp.ts) ---
  poisonAmp?: { threshold: number; mult: number }   // CANCRENA (stamped on ENEMY units)
  livingWall?: { reflect: number }                   // MURO VIVENTE (player Tanks): riflette una frazione del danno assorbito dallo scudo
  coldExecute?: { threshold: number; instakill: boolean } // ESECUZIONE A FREDDO (player attackers)
  reaper?: boolean                                   // MIETITORE (player units)
}

export type LogFlag = 'crit' | 'dodge' | 'kill' | 'heal' | 'block' | 'stun' | 'dot' | 'pen' | 'shatter' | 'wait' | 'recoil' | 'revive' | 'duo'

export interface LogEntry {
  turn: number
  actorId: string
  /** Side of the acting unit. Optional for backwards-compat; populated by the engine. */
  actorSide?: Side
  action: string
  targetId?: string
  /** Side of the targeted unit. Optional for backwards-compat; populated by the engine. */
  targetSide?: Side
  type: SpellType | 'system'
  value?: number
  flags: LogFlag[]
  /** Il Duo (player-only) che ha causato o modificato questa riga. La UI lo usa per
   *  nominare la combo nell'annuncio e per far lampeggiare la pill giusta. Puramente
   *  osservativo: non cambia nessun comportamento della simulazione. */
  duoId?: string
  /** Perché quest'azione ha scelto il suo bersaglio (solo azioni offensive). Osservativo: la UI
   *  lo usa per la riga-causa. NON serializzato per l'anti-cheat (il combat log non lo è). */
  reason?: TargetReason
  /** Transiente (NON persistito nel RunLog): il riflesso del Muro Vivente prodotto da questa
   *  azione. `resolveAction` lo travasa da `ctx.reflect`; `simulate.ts` lo consuma per emettere
   *  la riga `MuroVivente` e lo scarta prima di loggare. Mai serializzato. */
  _reflect?: { unitId: string; side: Side; amount: number }
}

/** Perché un'azione ha scelto quel bersaglio — osservativo, per la leggibilità del combattimento.
 *  Uno per famiglia di ramo di selectTarget. NON influenza la simulazione. */
export type TargetReason = 'taunt' | 'dive' | 'backline' | 'weakest' | 'threat'

export const TARGET_REASON_LABEL: Record<TargetReason, string> = {
  taunt: 'provocato',
  dive: 'affondo sul backline',
  backline: 'scavalca alle retrovie',
  weakest: 'il più debole',
  threat: 'la minaccia maggiore',
}

export interface UnitSnapshot { id: string; side: Side; hp: number; maxHp: number; alive: boolean }

/** Per-unit engine state captured at the instant a log entry is pushed. Deep-copied. */
export interface UnitStepState {
  hp: number
  alive: boolean
  cooldowns: Record<string, number>
  statusEffects: ActiveEffect[]
}

/** Full battlefield state at one log step, keyed by `${side}:${id}` (unitKey). */
export type StepSnapshot = Record<string, UnitStepState>

export interface BattleResult {
  winner: Side
  turns: number
  log: LogEntry[]
  mvpId: string
  finalSnapshot: UnitSnapshot[]
  /** 1:1 with `log`: snapshots[i] is the deep-copied state captured when log[i] was pushed. */
  snapshots: StepSnapshot[]
  /** True when the sim hit turnCap with both sides still having living units — a "win on points", not a clean wipe. */
  timedOut: boolean
  /** ENEMY units killed by each side this battle (direct-hit + DoT kills; excludes recoil
   *  self-kills and fatigue deaths). Drives within-run relic scaling. */
  kills: { left: number; right: number }
  /** Player-side (left) units that died this battle. Drives allyDead scaling jokers. */
  alliesLost: number
}
