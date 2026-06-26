import type { DraftedWizard, House, Wizard } from '@/types'
import type { Rng } from './rng'
import { createDraftPool } from './draft'
import { draftWizard } from './statRoll'
import { BALANCE } from '@/data/constants'

/** Weighted pick by tier (rarer tiers are less likely), removing the pick from the list. */
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
 * Build a recruitment offer: `offerSize` distinct candidates, at least
 * `houseGuarantee` from the player's house, none in `exclude`. House members
 * get a mild weight bias (`houseBiasWeight`) among the non-guaranteed picks.
 */
export function offerRecruits(
  rng: Rng,
  opts: { house: House; exclude: ReadonlySet<string> },
): DraftedWizard[] {
  const { offerSize, houseGuarantee, houseBiasWeight } = BALANCE.recruit
  const available = createDraftPool().filter(w => !opts.exclude.has(w.id))
  const chosen: Wizard[] = []

  // 1. Guaranteed house members (tier-weighted among the house pool).
  for (let g = 0; g < houseGuarantee; g++) {
    const housePool = available.filter(w => w.house === opts.house && !chosen.includes(w))
    if (housePool.length === 0) break
    chosen.push(takeWeighted(rng, [...housePool]))
  }

  // 2. Fill the rest from everyone left, with a mild house bias.
  while (chosen.length < offerSize) {
    const rest = available.filter(w => !chosen.includes(w))
    if (rest.length === 0) break
    chosen.push(pickBiased(rng, rest, opts.house, houseBiasWeight))
  }

  // 3. Roll each into a DraftedWizard (player draft → shiny allowed).
  return chosen.map(w => draftWizard(rng, w, true))
}

/** Tier-weighted pick with an extra multiplier for the player's house. Non-mutating. */
function pickBiased(rng: Rng, pool: Wizard[], house: House, houseBias: number): Wizard {
  const weights = pool.map(w => BALANCE.draft.tierWeights[w.tier] * (w.house === house ? houseBias : 1))
  const total = weights.reduce((a, b) => a + b, 0)
  let roll = rng.next() * total
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i]!
    if (roll <= 0) return pool[i]!
  }
  return pool[pool.length - 1]!
}

export function recruitVia(dw: DraftedWizard, via: string): DraftedWizard {
  return { ...dw, recruitedVia: via, level: 1, exp: 0, growthChoices: [] }
}

export function replaceMember(
  team: DraftedWizard[], outId: string, incoming: DraftedWizard,
): DraftedWizard[] {
  return team.map(m => (m.wizard.id === outId ? incoming : m))
}
