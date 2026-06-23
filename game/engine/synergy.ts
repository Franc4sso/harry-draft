import type { ActiveSynergy, DraftedWizard, Stats, Synergy } from '@/types'
import { SYNERGIES } from '@/data/synergies'

export interface SynergyProgress {
  synergy: Synergy
  count: number
  threshold: number
  active: boolean
  memberIds: string[]
}

export interface SynergyPreview extends SynergyProgress {
  nextCount: number
  advances: boolean
  willActivate: boolean
}

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
    (req.tag ? (d.wizard.tags ?? []).includes(req.tag) : true),
  )
  return matched.length >= count ? matched.map(d => d.wizard.id) : null
}

export function detectSynergies(team: DraftedWizard[]): ActiveSynergy[] {
  const out: ActiveSynergy[] = []
  for (const syn of SYNERGIES) {
    const members = membersFor(syn, team)
    if (members) out.push({ synergy: syn, memberIds: members })
  }
  return out
}

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

export function totalRegen(synergies: ActiveSynergy[]): number {
  return synergies.reduce((sum, { synergy }) => sum + (synergy.bonus.regen ?? 0), 0)
}

// --- progress helpers (append; do not modify detectSynergies/membersFor above) ---
export function synergyThreshold(syn: Synergy): number {
  const req = syn.requires
  return req.count ?? (req.ids ? req.ids.length : 3)
}

export function matchingMemberIds(syn: Synergy, team: DraftedWizard[]): string[] {
  const req = syn.requires
  if (req.ids && req.ids.length > 0) {
    return team.filter((d) => req.ids!.includes(d.wizard.id)).map((d) => d.wizard.id)
  }
  return team
    .filter((d) =>
      (req.house ? d.wizard.house === req.house : true) &&
      (req.role ? d.wizard.role === req.role : true) &&
      (req.tag ? (d.wizard.tags ?? []).includes(req.tag) : true),
    )
    .map((d) => d.wizard.id)
}

export function synergyProgress(team: DraftedWizard[]): SynergyProgress[] {
  return SYNERGIES.map((synergy) => {
    const memberIds = matchingMemberIds(synergy, team)
    const threshold = synergyThreshold(synergy)
    return { synergy, count: memberIds.length, threshold, active: memberIds.length >= threshold, memberIds }
  })
}

export function previewSynergies(team: DraftedWizard[], candidate: DraftedWizard): SynergyPreview[] {
  const withCand = [...team, candidate]
  return SYNERGIES.map((synergy) => {
    const memberIds = matchingMemberIds(synergy, team)
    const nextIds = matchingMemberIds(synergy, withCand)
    const threshold = synergyThreshold(synergy)
    const count = memberIds.length
    const nextCount = nextIds.length
    const active = count >= threshold
    return {
      synergy, count, threshold, active, memberIds,
      nextCount, advances: nextCount > count, willActivate: !active && nextCount >= threshold,
    }
  })
}
