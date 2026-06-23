import type { ActiveRelic, DraftedWizard, RelicCondition, Stats } from '@/types'

export function relicMatchesCondition(team: DraftedWizard[], condition?: RelicCondition): boolean {
  if (!condition) return true
  const count = condition.count ?? 3
  const matched = team.filter(d =>
    (condition.house ? d.wizard.house === condition.house : true) &&
    (condition.role ? d.wizard.role === condition.role : true),
  )
  return matched.length >= count
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
