import type { ActiveSynergy, DraftedWizard, Stats, Synergy } from '@/types'
import { SYNERGIES } from '@/data/synergies'
import { tagsOf } from '@/game/engine/roster'

function membersFor(syn: Synergy, team: DraftedWizard[]): string[] | null {
  const req = syn.requires
  if (req.ids && req.ids.length > 0) {
    const have = team.filter(d => req.ids!.includes(d.wizard.id))
    return have.length === req.ids.length ? have.map(d => d.wizard.id) : null
  }
  const count = req.count ?? 3
  const matched = team.filter(d =>
    (req.house ? d.wizard.house === req.house : true) &&
    (req.role ? d.wizard.role === req.role : true) &&
    (req.tag ? tagsOf(d).includes(req.tag) : true),
  )
  return matched.length >= count ? matched.map(d => d.wizard.id) : null
}

export function detectSynergies(team: DraftedWizard[]): ActiveSynergy[] {
  const all: ActiveSynergy[] = []
  for (const syn of SYNERGIES) {
    const members = membersFor(syn, team)
    if (members) all.push({ synergy: syn, memberIds: members })
  }
  // Within a family, keep only the highest threshold that is active.
  const bestByFamily = new Map<string, ActiveSynergy>()
  const out: ActiveSynergy[] = []
  for (const a of all) {
    const fam = a.synergy.family
    if (!fam) { out.push(a); continue }
    const cur = bestByFamily.get(fam)
    if (!cur || synergyThreshold(a.synergy) > synergyThreshold(cur.synergy)) {
      bestByFamily.set(fam, a)
    }
  }
  out.push(...bestByFamily.values())
  return out
}

export interface SynergyProgress {
  synergy: Synergy
  have: number
  need: number
  active: boolean
  memberIds: string[]
}

/** Progresso per-sinergia INCLUSO il conteggio parziale (2/3) — a differenza di membersFor/detectSynergies
 *  che scartano il parziale. Pura, per UI (le Costellazioni). Replica la logica di conteggio di membersFor. */
export function synergyProgress(team: DraftedWizard[]): SynergyProgress[] {
  return SYNERGIES.map(syn => {
    const req = syn.requires
    const need = req.count ?? 3
    const matched = req.ids && req.ids.length > 0
      ? team.filter(d => req.ids!.includes(d.wizard.id))
      : team.filter(d =>
          (req.house ? d.wizard.house === req.house : true) &&
          (req.role ? d.wizard.role === req.role : true) &&
          (req.tag ? tagsOf(d).includes(req.tag) : true),
        )
    const have = matched.length
    const needCount = req.ids ? req.ids.length : need
    return { synergy: syn, have, need: needCount, active: have >= needCount, memberIds: matched.map(d => d.wizard.id) }
  })
}

// Still exported: game/engine/combat/themes.ts uses this to derive each theme's
// minCount (Tossicità needs 3 veleno-tagged members) for themed enemy team generation.
export function synergyThreshold(syn: Synergy): number {
  const req = syn.requires
  return req.count ?? (req.ids ? req.ids.length : 3)
}

// Still used by game/engine/combat/simulate.ts: SYNERGIES-detected entries no longer carry
// stat bonuses (Tossicità is keywordMult-only), but a boss's synthetic exclusiveSynergy
// (data/bosses.ts) is delivered through the same ActiveSynergy[] channel and DOES carry a
// flat/allPct bonus (e.g. Voldemort's allPct 0.2) — this must keep applying it.
export function applyBonuses(stats: Stats, synergies: ActiveSynergy[]): Stats {
  let { hp, atk, def, spd } = stats
  let pct = 0
  for (const { synergy } of synergies) {
    const b = synergy.bonus
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
