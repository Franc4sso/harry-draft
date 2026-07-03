import type { Tier, Wizard } from '@/types'
import type { Rng } from './rng'
import { BALANCE } from '@/data/constants'
import { WIZARDS } from '@/data/wizards'

let poolRestriction: ReadonlySet<string> | null = null

/** Restrict the PLAYER's draft/recruit pool to a subset of wizard ids (or null to
 *  clear). Enemy generation reads WIZARDS directly and is unaffected. */
export function setDraftPoolRestriction(ids: Iterable<string> | null): void {
  poolRestriction = ids ? new Set(ids) : null
}

export function createDraftPool(): Wizard[] {
  return poolRestriction ? WIZARDS.filter(w => poolRestriction!.has(w.id)) : [...WIZARDS]
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
  _pickedTiers: Tier[],
  _screenIndex: number,
): Wizard[] {
  const { screenSize, maxTier1PerScreen } = BALANCE.draft
  const available = [...pool] // never mutate input pool
  const chosen: Wizard[] = []

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

  // Unconditional quality floor: guarantee at least one Tier<=3 (Raro or better)
  // per screen so a screen is never all-Comune. Epic/Legendary are NOT guaranteed —
  // they only appear via the weighted picks below, keeping them genuinely rare.
  take(w => w.tier <= 3)

  while (chosen.length < screenSize) {
    if (!take()) break
  }
  if (chosen.length !== screenSize) {
    throw new Error(`draft pool exhausted: got ${chosen.length}/${screenSize}`)
  }
  return chosen
}

export function commitPick(pool: Wizard[], screen: Wizard[], _pickedId: string): Wizard[] {
  const shown = new Set(screen.map(w => w.id))
  return pool.filter(w => !shown.has(w.id))
}
