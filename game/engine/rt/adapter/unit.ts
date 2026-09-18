import type { ActiveRelic, DraftedWizard } from '@/types'
import type { AbilityLine, RtRunExtras, RtUnitInput } from '@/types/rt'
import { applyRelicBonuses } from '@/game/engine/relics'
import { tagsOf } from '@/game/engine/roster'
import { SPELL_RT_BY_ID } from '@/data/spellsRt'
import { RT_SPELL_BY_WIZARD } from '@/data/rtLoadout'
import { ABILITY_BY_ID } from '@/data/abilities'
import { TRAIT_LINES_RT } from '@/data/traitsRt'
import { RELICS_RT } from '@/data/relicsRt'

const clampLevel = (n: number | undefined): 1 | 2 | 3 | 4 => Math.max(1, Math.min(4, Math.round(n ?? 1))) as 1 | 2 | 3 | 4

export function fromDrafted(dw: DraftedWizard, slot: number, team: DraftedWizard[], relics: ActiveRelic[], extras: RtRunExtras = {}): RtUnitInput {
  const id = dw.wizard.id
  const spellId = RT_SPELL_BY_WIZARD[id]
  const spell = spellId ? SPELL_RT_BY_ID[spellId] : undefined
  if (!spell) throw new Error(`nessuna spell rt per ${id}`)
  const ability = ABILITY_BY_ID[id]
  if (!ability) throw new Error(`nessuna abilità rt per ${id}`)
  const extraLines: AbilityLine[] = []
  if (dw.shiny) extraLines.push(...(TRAIT_LINES_RT[dw.shiny.traitId] ?? []))
  for (const ar of relics) if (ar.assignedTo === id) extraLines.push(...(RELICS_RT[ar.relic.id]?.carrierLines ?? []))
  return {
    id, name: dw.wizard.name, house: dw.wizard.house, role: dw.wizard.role, tier: dw.wizard.tier, tags: tagsOf(dw),
    stats: applyRelicBonuses(dw.stats, team, relics, id), level: clampLevel(dw.level), slot, spell, ability,
    extraLines: extraLines.length ? extraLines : undefined,
    memoria: extras.memoria, permanenti: extras.permanenti, corrotto: dw.corrotto ?? false,
  }
}
