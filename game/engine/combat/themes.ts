import type { Rng } from '../rng'
import type { Synergy, Wizard } from '@/types'
import { SYNERGIES } from '@/data/synergies'
import { WIZARDS } from '@/data/wizards'
import { BALANCE } from '@/data/constants'

export interface Theme {
  id: string
  label: string
  matches: (w: Wizard) => boolean
  poolSize: number
}

/** Build a predicate from a synergy's `requires` discriminant (house | role | tag).
 *  id-list synergies (e.g. Golden Trio) are NOT themes — they name specific wizards. */
function themeFromSynergy(syn: Synergy): Theme | null {
  const req = syn.requires
  if (req.ids && req.ids.length > 0) return null
  let id: string, label: string, matches: (w: Wizard) => boolean
  if (req.house) {
    id = `house:${req.house}`; label = req.house
    matches = (w) => w.house === req.house
  } else if (req.role) {
    id = `role:${req.role}`; label = req.role
    matches = (w) => w.role === req.role
  } else if (req.tag) {
    id = `tag:${req.tag}`; label = req.tag
    matches = (w) => (w.tags ?? []).includes(req.tag!)
  } else {
    return null
  }
  const poolSize = WIZARDS.filter(w => matches(w as Wizard)).length
  return { id, label, matches, poolSize }
}

/** Realizable themes: derived from synergy discriminants, deduped by id, pool >= 3.
 *  Sorted by id for deterministic ordering (no insertion-order dependence). */
export const THEMES: Theme[] = (() => {
  const byId = new Map<string, Theme>()
  for (const syn of SYNERGIES) {
    const t = themeFromSynergy(syn)
    if (t && t.poolSize >= 3 && !byId.has(t.id)) byId.set(t.id, t)
  }
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id))
})()

/** Weighted theme pick (larger pools slightly more likely → more realizable),
 *  excluding recently-used theme ids (anti-repetition within an area). Falls back
 *  to the full set if exclusion empties the pool. Deterministic for a given rng. */
export function pickTheme(rng: Rng, exclude: string[]): Theme | null {
  if (THEMES.length === 0) return null
  const ex = new Set(exclude)
  let pool = THEMES.filter(t => !ex.has(t.id))
  if (pool.length === 0) pool = THEMES
  const total = pool.reduce((s, t) => s + t.poolSize, 0)
  let r = rng.next() * total
  for (const t of pool) {
    r -= t.poolSize
    if (r <= 0) return t
  }
  return pool[pool.length - 1]!
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x))
}

/** Continuous theme intensity. No hardcoded area thresholds — scales to N areas.
 *  Final clamp01 guards the result if a future balance tune sets a nodeMult > 1
 *  (nodeMult is the documented primary lever — see BALANCE.themes calibration log). */
export function themeStrengthFor(area: number, kind: 'normal' | 'elite' | 'boss'): number {
  const t = BALANCE.themes
  return clamp01(clamp01(t.areaBase + area * t.areaStep) * t.nodeMult[kind])
}

/** How many of `teamCount` should realize the theme at this strength.
 *  strength 0 → 0 (fully mixed); strength 1 → whole team. Rounded. */
export function targetThemeMembers(strength: number, teamCount: number): number {
  return Math.max(0, Math.min(teamCount, Math.round(strength * teamCount)))
}
