import type { DraftedWizard, House } from '@/types'
import { starterOffer } from '@/game/engine/runEngine'
import { createRng, seedFromString } from '@/game/engine/rng'
import { draftWizard } from '@/game/engine/statRoll'
import { WIZARDS } from '@/data/wizards'

// Fixed, deterministic tutorial run seed.
export const TUTORIAL_SEED = 'tutorial'

/** Muro Vivente = signals ['scudirigen', 'taunt'] (data/duos.ts). `ernie` is a Tank who also
 *  carries the `scudirigen` tag, so he alone lights `taunt` (1 Tank — game/engine/duos.ts
 *  signalActive) and contributes 1/2 toward `scudirigen`. `cedric` and `sprout` both carry
 *  `scudirigen` too (data/wizards.ts), so any one of them paired with `ernie` already
 *  satisfies the tag's "2 tagged wizards" threshold with room to spare — the trio forms the
 *  Duo even if the player benches one of the two non-Tank picks later. All three are
 *  Tassorosso wizards (verified via data/wizards.ts), independent of the house the tutorial
 *  player chooses to draft from. */
export const TUTORIAL_DUO_ID = 'muro-vivente'
export const tutorialGuidedPickIds: string[] = ['ernie', 'cedric', 'sprout']

// Dedicated numeric fork channel so the guided picks' rolls never collide with any other
// consumer of TUTORIAL_SEED's rng stream.
const GUIDED_ROLL_CHANNEL = 97531

/** Deterministically resolve a specific wizard id to a DraftedWizard by scanning a fixed set
 *  of seeds' starter offers for the given house. Pure (no rng/time): iterates fixed seed
 *  strings in order. Only succeeds if `id` belongs to `house` (starterOffer filters by
 *  house), which is why `buildGuidedDrafted` below exists as a house-independent fallback. */
function findDraftedById(id: string, house: House): DraftedWizard | undefined {
  for (let i = 0; i < 50; i++) {
    const hit = starterOffer(`tutorial-${i}`, house).find(d => d.wizard.id === id)
    if (hit) return hit
  }
  return undefined
}

/** Build a real DraftedWizard for a fixed guided-pick wizard id, the same way
 *  `game/engine/statRoll.ts#draftWizard` does (fixed midpoint stats + one deterministic
 *  spell/shiny roll) — but independent of the player's chosen house, since the guided trio
 *  is a fixed cast (Tassorosso) regardless of which house the tutorial player drafts into.
 *  Deterministic: forks off TUTORIAL_SEED via a dedicated channel plus a per-id salt, so
 *  each guided wizard gets its own stable, non-colliding roll. */
function buildGuidedDrafted(id: string): DraftedWizard {
  const wizard = WIZARDS.find(w => w.id === id)
  if (!wizard) throw new Error(`tutorialOffer: unknown guided wizard id "${id}"`)
  const rng = createRng(TUTORIAL_SEED).fork(GUIDED_ROLL_CHANNEL).fork(seedFromString(id))
  return draftWizard(rng, wizard, true)
}

/** The real starter offer for TUTORIAL_SEED, re-ordered so the guided Duo trio occupies the
 *  first three slots. If any guided wizard isn't in the seed's natural (house-filtered)
 *  offer, it is injected — first by scanning other seeds' offers for the same house, then by
 *  building the DraftedWizard directly — so the tutorial never depends on the seed's
 *  emergent roll or on the guided trio's house matching the player's chosen house. */
export function tutorialStarterOffer(house: string): DraftedWizard[] {
  const h = house as House
  const base = starterOffer(TUTORIAL_SEED, h)
  const byId = new Map(base.map(d => [d.wizard.id, d]))
  for (const id of tutorialGuidedPickIds) {
    if (!byId.has(id)) {
      const found = findDraftedById(id, h) ?? buildGuidedDrafted(id)
      byId.set(id, found)
    }
  }
  const trio = tutorialGuidedPickIds.map(id => byId.get(id)).filter((d): d is DraftedWizard => !!d)
  const rest = base.filter(d => !tutorialGuidedPickIds.includes(d.wizard.id))
  return [...trio, ...rest]
}
