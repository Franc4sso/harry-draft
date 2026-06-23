import type { ActiveRelic, DraftedWizard, RelicCondition, Stats } from '@/types'
import type { Relic } from '@/types'
import type { Rng } from './rng'
import type { EventBus } from './combat/eventBus'
import { RELICS } from '@/data/relics'
import { BALANCE } from '@/data/constants'

export function relicMatchesCondition(team: DraftedWizard[], condition?: RelicCondition): boolean {
  if (!condition) return true
  const count = condition.count ?? 3
  const matched = team.filter(d =>
    (condition.house ? d.wizard.house === condition.house : true) &&
    (condition.role ? d.wizard.role === condition.role : true),
  )
  return matched.length >= count
}

/**
 * Register every left-relic trigger as a bus listener, in relic order then
 * trigger-array order. Condition gates are checked once at registration
 * (team composition is fixed for the battle). RNG is NOT consumed here.
 */
export function registerRelicTriggers(
  bus: EventBus, team: DraftedWizard[], relics: ActiveRelic[],
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
          bus.onReactive(trig.hook, () => specs)
        }
      }
      if (trig.modifier
        && (trig.hook === 'modifyOutgoingDamage' || trig.hook === 'modifyIncomingDamage'
          || trig.hook === 'modifyHealing')) {
        const { mult = 1, flat = 0 } = trig.modifier
        // Relics are LEFT-only: a left relic must never modify damage/healing for
        // RIGHT (enemy) units. Gate on the side carried in the HookCtx (set by the
        // emitModifier call sites: attacker side for outgoing, target side for
        // incoming, healed-unit side for healing).
        bus.onModifier(trig.hook, (v, ctx) => (ctx.side === 'left' ? v * mult + flat : v))
      }
    }
  }
}

export function applyRelicBonuses(stats: Stats, team: DraftedWizard[], relics: ActiveRelic[]): Stats {
  let { hp, atk, def, spd } = stats
  let pct = 0
  for (const { relic } of relics) {
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
    hp: Math.round(hp * m),
    atk: Math.round(atk * m),
    def: Math.round(def * m),
    spd: Math.round(spd * m),
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

export function offerRelics(rng: Rng, owned: ActiveRelic[], _stage: number): Relic[] {
  const ownedIds = new Set(owned.map(o => o.relic.id))
  const available = RELICS.filter(r => !ownedIds.has(r.id))
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
