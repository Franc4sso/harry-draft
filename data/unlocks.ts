import type { RunEndSummary } from '@/lib/metaProgress'

// Authored per the meta-progression plan; enforced by tests/data/unlocks.test.ts.
// All tier-1 (dumbledore, voldemort, harry) + all tier-2 (snape, bellatrix, mcgonagall,
// sirius, lupin, moody, lucius, kingsley, fleur, viktor) wizards, plus a tier-3 sample
// covering all 4 houses and all 4 roles, the Golden Trio (harry/ron/hermione), and
// >=3 veleno-tagged wizards (bellatrix, sprout, narcissa).
export const STARTER_WIZARDS: string[] = [
  // Tier 1
  'dumbledore', 'voldemort', 'harry',
  // Tier 2
  'snape', 'bellatrix', 'mcgonagall', 'sirius', 'lupin', 'moody', 'lucius', 'kingsley', 'fleur', 'viktor',
  // Tier 3 (trio + house/role coverage + veleno)
  'ron', 'hermione', 'sprout', 'narcissa', 'hagrid', 'cedric', 'luna',
]

// ~12 real relic ids from data/relics.ts, all comune + a half of the non-comune tier
// (cuore-del-tasso is deliberately left locked as a milestone/purchase reward).
export const STARTER_RELICS: string[] = [
  'giratempo', 'mantello-invisibilita', 'mappa-malandrino', 'pozione-fortuna', 'bezoar', 'ricordatutto',
  'medaglione-serpeverde', 'diadema-corvonero', 'coppa-tassorosso', 'ampolla-veleno', 'sigillo-carnefice', 'diadema-corrotto',
]

export const UNLOCK_COSTS = { wizard: 100, relic: 60 } as const

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
