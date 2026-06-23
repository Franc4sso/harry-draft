import type { Wizard, Synergy } from '@/types'
import { SYNERGIES } from '@/data/synergies'

export interface Affiliation { synergyId: string; label: string; kind: Synergy['kind'] }

export function wizardMatchesSynergy(wizard: Wizard, syn: Synergy): boolean {
  const req = syn.requires
  if (req.ids && req.ids.length > 0) return req.ids.includes(wizard.id)
  return (
    (req.house ? wizard.house === req.house : true) &&
    (req.role ? wizard.role === req.role : true) &&
    (req.tag ? (wizard.tags ?? []).includes(req.tag) : true)
  )
}

export function wizardAffiliations(wizard: Wizard): Affiliation[] {
  return SYNERGIES.filter((syn) => wizardMatchesSynergy(wizard, syn)).map((syn) => ({
    synergyId: syn.id, label: syn.name, kind: syn.kind,
  }))
}
