import type { RunEndSummary } from '@/lib/metaProgress'
import type { Tier, Wizard } from '@/types/wizard'
import type { Relic, RelicRarity } from '@/types/relic'

// Authored per the meta-progression plan; enforced by tests/data/unlocks.test.ts.
// Mirrors the natural 60-wizard roster curve (tier1:3, tier2:10, tier3:20, tier4:27)
// instead of force-including every tier-1/tier-2 wizard (that produced a 65%
// legendary/epic, zero-common starter pool and an epic-flooded opening draft).
// Final composition: 1 tier-1, 2 tier-2, 6 tier-3, 9 tier-4 (18 total; ~17% high
// -rarity share, 9 commons) — the highest-power natural-feeling mix that still
// clears the campaignBalanceRestricted.test.ts win-rate band; see that file's sweep
// notes in this repo's fix report for the tradeoffs tried (T2=3-4 pushed winRate
// back up to/over the 0.45 ceiling).
// Covers all 4 houses and all 4 roles, the Golden Trio (harry/ron/hermione), and
// >=3 veleno-tagged wizards (bellatrix, narcissa, sprout). Milestone-unlock ids
// (dolohov, greyback, neville, molly) are deliberately left out so they stay
// reachable-but-locked.
// NOTE: `chooseStarters` draws the opening 3 from a Grifondoro-only offer sorted by
// raw power. Grifondoro membership is kept to exactly harry/ron/hermione so that
// offer collapses to the Golden Trio itself (thematic, and empirically the balance-
// stable choice) rather than accidentally auto-selecting an all-tank or all-attacker
// trio from a larger Grifondoro slice (that swung the restricted-pool win rate from
// 0.15 to 0.63 in an earlier draft of this list — see campaignBalanceRestricted.test.ts).
export const STARTER_WIZARDS: string[] = [
  // Tier 1
  'harry',
  // Tier 2
  'bellatrix', 'kingsley',
  // Tier 3 (trio + house/role coverage + veleno)
  'ron', 'hermione', 'narcissa', 'sprout', 'draco', 'cedric',
  // Tier 4 (commons — the key regression guard against the old zero-common set)
  'goyle', 'marcus', 'michael', 'padma', 'hannah', 'ernie', 'pettigrew', 'terry', 'roger',
]

// ~12 real relic ids from data/relics.ts, all comune + a half of the non-comune tier
// (cuore-del-tasso is deliberately left locked as a milestone/purchase reward).
export const STARTER_RELICS: string[] = [
  'giratempo', 'mantello-invisibilita', 'mappa-malandrino', 'pozione-fortuna', 'bezoar', 'ricordatutto',
  'medaglione-serpeverde', 'diadema-corvonero', 'coppa-tassorosso', 'ampolla-veleno', 'sigillo-carnefice', 'diadema-corrotto',
  'fame-vorace', 'collezionista-anime', 'marchio-vorace',
]

// Rarity-scaled unlock costs: rarer = pricier. Tier 1 (Leggendario) is the rarest
// wizard tier (see types/wizard.ts Tier comment order), so it costs the most; the
// relic table mirrors the same 4-step curve over RelicRarity.
export const WIZARD_COST_BY_TIER: Record<Tier, number> = {
  1: 500, // Leggendario
  2: 250, // Epico
  3: 120, // Raro
  4: 60,  // Comune
}

export const RELIC_COST_BY_RARITY: Record<RelicRarity, number> = {
  epica: 300,
  rara: 150,
  'non-comune': 80,
  comune: 40,
}

export function wizardUnlockCost(wizard: Wizard): number {
  return WIZARD_COST_BY_TIER[wizard.tier]
}

export function relicUnlockCost(relic: Relic): number {
  return RELIC_COST_BY_RARITY[relic.rarity]
}

export const EARN = { perAreaCleared: 15, perBossDefeated: 20, firstWinBonus: 60, lossFloor: 10 } as const

export interface UnlockTarget { kind: 'wizard' | 'relic'; id: string; label: string }
export interface Milestone { id: string; when: (s: RunEndSummary) => boolean; unlock: UnlockTarget }

export const MILESTONES: Milestone[] = [
  // Il Muro (area-0 scripted boss) falls.
  { id: 'beat-muro', when: s => s.bossesDefeated >= 1, unlock: { kind: 'wizard', id: 'dolohov', label: 'Antonin Dolohov' } },
  // Bellatrix (area-1 scripted boss) falls.
  { id: 'beat-bellatrix', when: s => s.bossesDefeated >= 2, unlock: { kind: 'wizard', id: 'greyback', label: 'Fenrir Greyback' } },
  // First full-campaign win (Voldemort, the final boss, falls too).
  { id: 'first-win', when: s => s.outcome === 'win', unlock: { kind: 'wizard', id: 'neville', label: 'Neville Paciock' } },
  // Cleared every area of the run.
  { id: 'reach-final-area', when: s => s.areasCleared >= 3, unlock: { kind: 'relic', id: 'cuore-del-tasso', label: 'Cuore del Tasso' } },
  // Named-synergy milestone: fires if the player finished with the Golden Trio active.
  { id: 'trio-complete', when: s => s.namedSynergiesActive.includes('goldenTrio'), unlock: { kind: 'wizard', id: 'molly', label: 'Molly Weasley' } },
]
