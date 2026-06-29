import type { DraftedWizard, UnitSnapshot } from '@/types'
import { BALANCE } from '@/data/constants'

/** RNG channel for the draft phase (consumed by draftSession). */
export const draftRngChannel = 1

export function applyBattleToRoster(
  team: DraftedWizard[], snapshot: UnitSnapshot[],
): DraftedWizard[] {
  // Only the LEFT side is the player team. A player wizard must NEVER read an
  // enemy's snapshot entry: enemies draft from the same top-power roster, so a
  // player and enemy can share a base id. Keying by id alone let the right-side
  // (spread after left) entry overwrite the player's — surviving players got
  // dropped, dead players wrongly kept, HP sourced from the wrong unit (C1).
  const byId = new Map(snapshot.filter(s => s.side === 'left').map(s => [s.id, s]))
  return team.map(dw => {
    const snap = byId.get(dw.wizard.id)
    if (!snap) return dw                                  // no snapshot entry → unchanged
    const frac = snap.maxHp > 0 ? snap.hp / snap.maxHp : 0
    return { ...dw, currentHp: Math.round(dw.maxHp * frac) }   // 0 when dead → benched
  })
}

/**
 * Per-stage enemy stat multiplier percentage. Gentle early (menaceBase), steep
 * late (menacePerStage * depth), amplified on elite/boss nodes. Calibrated in
 * the campaign balance test.
 */
export function menacePctFor(depth: number, nodeType: 'normal' | 'elite' | 'boss'): number {
  const c = BALANCE.campaign
  const base = c.menaceBase + c.menacePerStage * depth
  if (nodeType === 'elite') return base * c.menaceEliteMult
  if (nodeType === 'boss') return base * c.menaceBossMult
  return base
}
