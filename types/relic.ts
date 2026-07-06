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
  /** Reactive trigger fires only when ctx.turn === onlyTurn (e.g. 1 = opening turn). */
  onlyTurn?: number
}

export interface RelicScaling {
  /** What event increments the run counter. Run-cumulative, reset each run. */
  trigger: 'kill' | 'battleWin' | 'turn' | 'allyDead'
  /** Which stat the counter feeds. */
  stat: 'attack' | 'maxHp' | 'velenoMult' | 'defense' | 'speed'
  /** Bonus added per counter unit. */
  per: number
  /** Absolute cap on the cumulative bonus (applied at read time). */
  cap: number
}

/** Static "when X then Y" gate — team composition is fixed during a battle, so this
 *  is evaluated once at applyRelicBonuses time (not on the bus). */
export interface RelicConditional {
  when: { kind: 'teamSizeBelow'; value: number }
  then: SynergyBonus
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
  /** Grants the whole team guaranteed-hit (ignores dodge) — Occhio Magico relic. */
  grantsAlwaysHit?: boolean
  /** Grants the team a regen-overflow → shield conversion (Scudi-Rigen archetype): `rate` of
   *  the regen tick's overflow-above-maxHp becomes shield. Stacked/scaled via teamShieldConvert. */
  grantsShieldConvert?: { rate: number }
  /** Grants a single ASSIGNED carrier (ActiveRelic.assignedTo) the Magie Oscure amplify + recoil:
   *  +bonus dmg on dark spells, recoil = that fraction of damage DEALT back to the caster (lethal). */
  grantsDarkMagic?: { bonus: number; recoil: number }
  /** When true, this relic is assigned to ONE wizard at draft time (see ActiveRelic.assignedTo). */
  assignable?: boolean
  /** Consumable active-use relic (not a passive combat descriptor). 'revive' = Lacrime di Fenice. */
  active?: 'revive'
  /** Within-run scaling ("joker"): grows a stat as the run counter climbs. Reset each run. */
  scaling?: RelicScaling
  /** Static conditional bonus (see RelicConditional). */
  conditional?: RelicConditional
  /** Always-on malus (SynergyBonus with negative values). Risk/reward jokers. */
  drawback?: SynergyBonus
}

export interface ActiveRelic {
  relic: Relic
  stageObtained: number
  assignedTo?: string   // wizardId of the carrier (for `assignable` relics); undefined = unassigned
  /** Within-run cumulative trigger count for `relic.scaling`. Undefined == 0. Never persisted to MetaProfile. */
  runCounter?: number
}
