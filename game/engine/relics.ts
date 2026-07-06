import type { ActiveRelic, ActiveSynergy, DraftedWizard, Keyword, RelicCondition, RelicScaling, Stats, Side } from '@/types'
import type { Relic } from '@/types'
import type { Rng } from './rng'
import type { EventBus } from './combat/eventBus'
import { RELICS, SCALING_RELIC_IDS } from '@/data/relics'
import { BALANCE } from '@/data/constants'

let relicRestriction: ReadonlySet<string> | null = null

/** Restrict the PLAYER's relic offer pool to a subset of relic ids (or null to
 *  clear). Enemy relic selection (`selectEnemyRelics`) reads RELICS directly
 *  and is unaffected. */
export function setRelicPoolRestriction(ids: Iterable<string> | null): void {
  relicRestriction = ids ? new Set(ids) : null
}

function restrictedRelicPool(all: Relic[]): Relic[] {
  return relicRestriction ? all.filter(r => relicRestriction!.has(r.id)) : all
}

export function relicMatchesCondition(team: DraftedWizard[], condition?: RelicCondition): boolean {
  if (!condition) return true
  const count = condition.count ?? 3
  const matched = team.filter(d =>
    (condition.house ? d.wizard.house === condition.house : true) &&
    (condition.role ? d.wizard.role === condition.role : true),
  )
  return matched.length >= count
}

export interface ScalingDeltas { kill: number; battleWin: number; turn: number; allyDead: number }

/** After a battle, add the per-trigger delta to the run counter of every scaling relic. Pure. */
export function applyRelicScaling(relics: ActiveRelic[], deltas: ScalingDeltas): ActiveRelic[] {
  return relics.map(ar => {
    const s = ar.relic.scaling
    if (!s) return ar
    const d = deltas[s.trigger]
    if (d <= 0) return ar
    return { ...ar, runCounter: (ar.runCounter ?? 0) + d }
  })
}

/** Read-time scaling bonus for a relic's `scaling` descriptor, clamped at cap. */
export function scalingStatBonus(
  relic: Relic, runCounter: number | undefined, stat: RelicScaling['stat'],
): number {
  const s = relic.scaling
  if (!s || s.stat !== stat) return 0
  return Math.min((runCounter ?? 0) * s.per, s.cap)
}

/** Team-level damage multiplier for a keyword: 1 + Σ keywordMult[keyword] over
 *  active (condition-matching) relics + active synergies. Consumes no RNG. */
export function keywordDamageMult(
  team: DraftedWizard[], relics: ActiveRelic[], synergies: ActiveSynergy[], keyword: Keyword,
): number {
  let mult = 1
  for (const { relic, runCounter } of relics) {
    if (relicMatchesCondition(team, relic.condition)) {
      mult += relic.keywordMult?.[keyword] ?? 0
    }
    if (keyword === 'veleno') mult += scalingStatBonus(relic, runCounter, 'velenoMult')
  }
  for (const { synergy } of synergies) {
    mult += synergy.bonus.keywordMult?.[keyword] ?? 0
  }
  return mult
}

/**
 * Register relic triggers as bus listeners for the given owner side (default 'left').
 * Listeners gate on `side` so relics only fire for the team that owns them.
 * Condition gates are checked once at registration (team composition is fixed).
 * RNG is NOT consumed here.
 */
export function registerRelicTriggers(
  bus: EventBus, team: DraftedWizard[], relics: ActiveRelic[], side: Side = 'left',
): void {
  for (const { relic } of relics) {
    for (const trig of relic.triggers ?? []) {
      const gate = trig.condition ?? relic.condition
      if (!relicMatchesCondition(team, gate)) continue
      if (trig.effects) {
        const specs = trig.effects
        if (trig.hook === 'onBattleStart' || trig.hook === 'onHit'
          || trig.hook === 'onHeal' || trig.hook === 'onDeath'
          || trig.hook === 'onAllyDeath' || trig.hook === 'onTurnStart'
          || trig.hook === 'onTurnEnd' || trig.hook === 'onHpThreshold') {
          bus.onReactive(trig.hook, (ctx) => (ctx.side === side ? specs : []))
        }
      }
      if (trig.modifier
        && (trig.hook === 'modifyOutgoingDamage' || trig.hook === 'modifyIncomingDamage'
          || trig.hook === 'modifyHealing')) {
        const { mult = 1, flat = 0 } = trig.modifier
        // Gate on the owner side so a relic must never modify damage/healing for
        // the opposing team. Side is carried in HookCtx (attacker side for outgoing,
        // target side for incoming, healed-unit side for healing).
        bus.onModifier(trig.hook, (v, ctx) => (ctx.side === side ? v * mult + flat : v))
      }
    }
  }
}

export function applyRelicBonuses(stats: Stats, team: DraftedWizard[], relics: ActiveRelic[]): Stats {
  let { hp, atk, def, spd } = stats
  let pct = 0
  let scaledHp = 0
  let scaledAtk = 0
  let scaledDef = 0
  let scaledSpd = 0
  for (const { relic, runCounter } of relics) {
    scaledHp += scalingStatBonus(relic, runCounter, 'maxHp')
    scaledAtk += scalingStatBonus(relic, runCounter, 'attack')
    scaledDef += scalingStatBonus(relic, runCounter, 'defense')
    scaledSpd += scalingStatBonus(relic, runCounter, 'speed')
    if (!relic.bonus) continue
    if (!relicMatchesCondition(team, relic.condition)) continue
    const b = relic.bonus
    hp += b.hp ?? 0
    atk += b.atk ?? 0
    def += b.def ?? 0
    spd += b.spd ?? 0
    pct += b.allPct ?? 0
  }
  const m = 1 + pct
  return {
    hp: Math.round(hp * m) + scaledHp,
    atk: Math.round(atk * m) + scaledAtk,
    def: Math.round(def * m) + scaledDef,
    spd: Math.round(spd * m) + scaledSpd,
  }
}

export function totalRelicRegen(team: DraftedWizard[], relics: ActiveRelic[]): number {
  return relics.reduce((sum, { relic }) =>
    relic.bonus && relicMatchesCondition(team, relic.condition)
      ? sum + (relic.bonus.regen ?? 0)
      : sum, 0)
}

function weightedPick(rng: Rng, pool: Relic[]): Relic {
  const weights = pool.map(r => BALANCE.relics.rarityWeights[r.rarity])
  const total = weights.reduce((a, b) => a + b, 0)
  let roll = rng.next() * total
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i]!
    if (roll <= 0) return pool[i]!
  }
  return pool[pool.length - 1]!
}

/**
 * Pick `count` distinct relics weighted by rarity (reusing `weightedPick`),
 * wrapped as ActiveRelic with stageObtained 0. Deterministic per rng. Never
 * returns more than the pool size. Used to arm elite/boss enemy teams.
 */
export function selectEnemyRelics(rng: Rng, count: number): ActiveRelic[] {
  const scaling = new Set(SCALING_RELIC_IDS)
  const remaining = RELICS.filter(r => !scaling.has(r.id))
  const n = Math.min(count, remaining.length)
  const out: ActiveRelic[] = []
  for (let i = 0; i < n; i++) {
    const pick = weightedPick(rng, remaining)
    out.push({ relic: pick, stageObtained: 0 })
    remaining.splice(remaining.indexOf(pick), 1)
  }
  return out
}

export function offerRelics(rng: Rng, owned: ActiveRelic[], _stage: number): Relic[] {
  const ownedIds = new Set(owned.map(o => o.relic.id))
  const available = restrictedRelicPool(RELICS).filter(r => !ownedIds.has(r.id))
  const count = Math.min(BALANCE.relics.offerCount, available.length)
  const chosen: Relic[] = []
  const remaining = [...available]
  for (let i = 0; i < count; i++) {
    const pick = weightedPick(rng, remaining)
    chosen.push(pick)
    const idx = remaining.indexOf(pick)
    remaining.splice(idx, 1)
  }
  return chosen
}
