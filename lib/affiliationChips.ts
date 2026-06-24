import type { Wizard } from '@/types'
import { wizardAffiliations } from '@/lib/affiliations'

export type AffiliationChipKind = 'house' | 'role' | 'special'

export interface AffiliationChip {
  id: string
  label: string
  kind: AffiliationChipKind
  /** Set for special chips — the synergy id, for hot-glow matching. */
  synergyId?: string
}

/**
 * The chips a wizard's draft card shows: always a name-only house chip and a
 * role chip (derived from the wizard itself, so they read "Grifondoro" /
 * "Tank" — never the raw synergy name "3 Grifondoro" and never a count), then
 * one gold "special" chip per group/origin synergy the wizard belongs to.
 * House/role-kind synergies do not add a separate chip — the house/role chips
 * already represent them — which is what removes the clutter and duplication.
 */
export function affiliationChips(wizard: Wizard): AffiliationChip[] {
  const chips: AffiliationChip[] = [
    { id: `house:${wizard.house}`, label: wizard.house, kind: 'house' },
    { id: `role:${wizard.role}`, label: wizard.role, kind: 'role' },
  ]
  for (const aff of wizardAffiliations(wizard)) {
    if (aff.kind === 'group' || aff.kind === 'origin') {
      chips.push({ id: `syn:${aff.synergyId}`, label: aff.label, kind: 'special', synergyId: aff.synergyId })
    }
  }
  return chips
}
