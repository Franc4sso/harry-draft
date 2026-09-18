import type { ActiveRelic, DraftedWizard } from '@/types'
import type { Rng } from '@/game/engine/rng'
import type { RtBattleResult, RtRunExtras, RtSideMods, RtUnitInput } from '@/types/rt'
import { simulateRt } from '../simulate'
import { fromDrafted } from './unit'
import { sideModsFor } from './sideMods'
export { fromDrafted, sideModsFor }

export function toRtSide(team: DraftedWizard[], relics: ActiveRelic[], extrasById: Record<string, RtRunExtras> = {}): { units: RtUnitInput[]; mods: RtSideMods } {
  const units = team.map((dw, i) => fromDrafted(dw, (dw as { slot?: number }).slot ?? i, team, relics, extrasById[dw.wizard.id]))
  return { units, mods: sideModsFor(team, relics) }
}

export interface SimulateTeamsOpts { leftRelics?: ActiveRelic[]; rightRelics?: ActiveRelic[]; kind?: 'normal' | 'elite' | 'boss'; leftExtras?: Record<string, RtRunExtras>; rightExtras?: Record<string, RtRunExtras>; maxSeconds?: number }

export function simulateTeams(left: DraftedWizard[], right: DraftedWizard[], rng: Rng, opts: SimulateTeamsOpts = {}): RtBattleResult {
  const L = toRtSide(left, opts.leftRelics ?? [], opts.leftExtras)
  const R = toRtSide(right, opts.rightRelics ?? [], opts.rightExtras)
  return simulateRt(L.units, R.units, rng, { leftMods: L.mods, rightMods: R.mods, kind: opts.kind, maxSeconds: opts.maxSeconds })
}
