import type { Tier, Wizard } from '@/types'
import type { Rng } from './rng'
import { BALANCE } from '@/data/constants'
import { WIZARDS } from '@/data/wizards'

export function createDraftPool(): Wizard[] {
  return [...WIZARDS]
}

function weightedPick(rng: Rng, candidates: Wizard[]): Wizard {
  const weights = candidates.map(w => BALANCE.draft.tierWeights[w.tier])
  const total = weights.reduce((a, b) => a + b, 0)
  let roll = rng.next() * total
  for (let i = 0; i < candidates.length; i++) {
    roll -= weights[i]!
    if (roll <= 0) return candidates[i]!
  }
  return candidates[candidates.length - 1]!
}

export function generateScreen(
  rng: Rng,
  pool: Wizard[],
  pickedTiers: Tier[],
  screenIndex: number,
): Wizard[] {
  const { screenSize, maxTier1PerScreen, pityAfterPicks, pityMaxTier } = BALANCE.draft
  const available = [...pool] // never mutate input pool
  const chosen: Wizard[] = []

  // Computed for documentation/future tuning only — the guarantee is unconditional.
  const _pityActive =
    screenIndex >= pityAfterPicks &&
    pickedTiers.length >= pityAfterPicks &&
    !pickedTiers.some(t => t <= pityMaxTier)
  void _pityActive

  const take = (predicate?: (w: Wizard) => boolean): Wizard | undefined => {
    const pickable = available.filter(
      w =>
        !chosen.includes(w) &&
        (predicate ? predicate(w) : true) &&
        (w.tier !== 1 || chosen.filter(c => c.tier === 1).length < maxTier1PerScreen),
    )
    if (pickable.length === 0) return undefined
    const w = weightedPick(rng, pickable)
    chosen.push(w)
    return w
  }

  // Every screen guarantees at least one Tier <=2 seat (this also satisfies pity).
  take(w => w.tier <= 2)

  while (chosen.length < screenSize) {
    if (!take()) break
  }
  return chosen
}

export function commitPick(pool: Wizard[], screen: Wizard[], _pickedId: string): Wizard[] {
  const shown = new Set(screen.map(w => w.id))
  return pool.filter(w => !shown.has(w.id))
}
