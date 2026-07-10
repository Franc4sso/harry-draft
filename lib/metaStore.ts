export interface MetaStats {
  runsPlayed: number
  runsWon: number
  bossesKilled: number
  bestStageReached: number
  totalCioccoraneEarned: number
  wizardUsage: Record<string, number>
}

export interface MetaCodex {
  wizardsSeen: string[]
  relicsSeen: string[]
  synergiesSeen: string[]
  bossesSeen: string[]
  duosSeen: string[]
}

export interface MetaProfile {
  version: 1
  cioccorane: number
  unlockedWizards: string[]
  unlockedRelics: string[]
  milestones: Record<string, boolean>
  stats: MetaStats
  codex: MetaCodex
}

export const PROFILE_KEY = 'harry:profile:v1'

export function defaultProfile(): MetaProfile {
  return {
    version: 1,
    cioccorane: 0,
    unlockedWizards: [],
    unlockedRelics: [],
    milestones: {},
    stats: {
      runsPlayed: 0, runsWon: 0, bossesKilled: 0,
      bestStageReached: 0, totalCioccoraneEarned: 0, wizardUsage: {},
    },
    codex: { wizardsSeen: [], relicsSeen: [], synergiesSeen: [], bossesSeen: [], duosSeen: [] },
  }
}

function ls(): Storage | null {
  return typeof localStorage !== 'undefined' ? localStorage : null
}

export function loadProfile(): MetaProfile {
  const store = ls()
  if (!store) return defaultProfile()
  try {
    const raw = store.getItem(PROFILE_KEY)
    if (!raw) return defaultProfile()
    const parsed = JSON.parse(raw) as Partial<MetaProfile>
    if (!parsed || parsed.version !== 1) return defaultProfile()
    // Merge onto a default so a partial/older record never yields undefined fields.
    const d = defaultProfile()
    return {
      ...d, ...parsed,
      stats: { ...d.stats, ...(parsed.stats ?? {}) },
      codex: { ...d.codex, ...(parsed.codex ?? {}) },
    }
  } catch {
    return defaultProfile()
  }
}

export function saveProfile(p: MetaProfile): void {
  ls()?.setItem(PROFILE_KEY, JSON.stringify(p))
}

export function grantCioccorane(p: MetaProfile, n: number): MetaProfile {
  return {
    ...p,
    cioccorane: p.cioccorane + n,
    stats: { ...p.stats, totalCioccoraneEarned: p.stats.totalCioccoraneEarned + Math.max(0, n) },
  }
}

export function spendCioccorane(p: MetaProfile, n: number): MetaProfile | null {
  if (n > p.cioccorane) return null
  return { ...p, cioccorane: p.cioccorane - n }
}

function addUnique(list: string[], id: string): string[] {
  return list.includes(id) ? list : [...list, id]
}

export function unlockWizard(p: MetaProfile, id: string): MetaProfile {
  return { ...p, unlockedWizards: addUnique(p.unlockedWizards, id) }
}

export function unlockRelic(p: MetaProfile, id: string): MetaProfile {
  return { ...p, unlockedRelics: addUnique(p.unlockedRelics, id) }
}

export function markSeen(
  p: MetaProfile, kind: 'wizard' | 'relic' | 'synergy' | 'boss' | 'duo', id: string,
): MetaProfile {
  const key = ({ wizard: 'wizardsSeen', relic: 'relicsSeen', synergy: 'synergiesSeen', boss: 'bossesSeen', duo: 'duosSeen' } as const)[kind]
  return { ...p, codex: { ...p.codex, [key]: addUnique(p.codex[key], id) } }
}
