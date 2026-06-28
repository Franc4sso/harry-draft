import type { DraftedWizard, Wizard } from '@/types'
import type { Rng } from './rng'
import { createDraftPool } from './draft'
import { draftWizard } from './statRoll'
import { BALANCE } from '@/data/constants'

/** Tier-weighted pick (rarer tiers less likely). Mutates the passed array by splicing out the pick — callers pass a throwaway copy. */
function takeWeighted(rng: Rng, pool: Wizard[]): Wizard {
  const weights = pool.map(w => BALANCE.draft.tierWeights[w.tier])
  const total = weights.reduce((a, b) => a + b, 0)
  let roll = rng.next() * total
  let idx = pool.length - 1
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i]!
    if (roll <= 0) { idx = i; break }
  }
  return pool.splice(idx, 1)[0]!
}

/**
 * Build a recruitment offer: `offerSize` distinct tier-weighted candidates,
 * none in `exclude`. Rarer tiers are less likely (see `BALANCE.draft.tierWeights`).
 */
export function offerRecruits(
  rng: Rng,
  opts: { exclude: ReadonlySet<string> },
): DraftedWizard[] {
  const { offerSize } = BALANCE.recruit
  const available = createDraftPool().filter(w => !opts.exclude.has(w.id))
  const chosen: Wizard[] = []

  // Fill the offer with distinct tier-weighted picks (takeWeighted splices `available`).
  while (chosen.length < offerSize && available.length > 0) {
    chosen.push(takeWeighted(rng, available))
  }

  // Guard: pool must have satisfied the full offer.
  if (chosen.length < offerSize) {
    throw new Error(`recruit pool exhausted: got ${chosen.length}/${offerSize} (excluded=${opts.exclude.size})`)
  }

  // Roll each into a DraftedWizard (player draft → shiny allowed).
  return chosen.map(w => draftWizard(rng, w, true))
}

export function recruitVia(dw: DraftedWizard, via: string): DraftedWizard {
  return { ...dw, recruitedVia: via, level: 1, exp: 0, growthChoices: [] }
}

export function replaceMember(
  team: DraftedWizard[], outId: string, incoming: DraftedWizard,
): DraftedWizard[] {
  return team.map(m => (m.wizard.id === outId ? incoming : m))
}
