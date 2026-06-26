import type { DraftedWizard } from '@/types'
import { TRAIT_BY_ID } from '@/data/traits'

/** Full display name, with a gender-agreed epithet when the wizard is shiny. */
export function displayName(dw: DraftedWizard): string {
  if (!dw.shiny) return dw.wizard.name
  const trait = TRAIT_BY_ID[dw.shiny.traitId]
  if (!trait) return dw.wizard.name
  return `${dw.wizard.name}, ${trait.epithet[dw.wizard.gender]}`
}
