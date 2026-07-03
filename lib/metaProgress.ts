import type { RunState } from '@/types'
import { BALANCE } from '@/data/constants'
import type { MetaProfile } from '@/lib/metaStore'
import { grantCioccorane, unlockWizard, unlockRelic } from '@/lib/metaStore'
import { MILESTONES, EARN, type UnlockTarget } from '@/data/unlocks'

// Real named-synergy ids from data/synergies.ts (kind: 'group' | 'origin', excludes the
// plain house/role count synergies which aren't individually "named" milestones).
const NAMED_SYNERGY_IDS = new Set([
  'goldenTrio', 'weasley', 'order', 'deatheater', 'tossicita',
  'spietatezza', 'bastione', 'oscurita', 'marauder', 'da',
])

export interface RunEndSummary {
  outcome: 'win' | 'defeat'
  areasCleared: number
  bossesDefeated: number
  namedSynergiesActive: string[]
  teamWizardIds: string[]
}

/** Derive the meta-relevant summary from a finished RunState (phase 'win' | 'defeat').
 *  bossesDefeated: advancing past area N means area N's boss fell, so a defeat at
 *  area A implies A bosses down; a win means all areas' bosses fell. */
export function buildRunEndSummary(run: RunState): RunEndSummary {
  const outcome: 'win' | 'defeat' = run.phase === 'win' ? 'win' : 'defeat'
  const area = run.area ?? 0
  const areasCleared = outcome === 'win' ? BALANCE.map.areas : area
  const bossesDefeated = areasCleared
  return {
    outcome,
    areasCleared,
    bossesDefeated,
    namedSynergiesActive: (run.activeSynergies ?? [])
      .map(a => a.synergy.id)
      .filter(id => NAMED_SYNERGY_IDS.has(id)),
    teamWizardIds: run.team.map(d => d.wizard.id),
  }
}

export function earnCioccorane(s: RunEndSummary): number {
  const base = s.areasCleared * EARN.perAreaCleared + s.bossesDefeated * EARN.perBossDefeated
  const withWin = s.outcome === 'win' ? base + EARN.firstWinBonus : base
  return Math.max(EARN.lossFloor, withWin)
}

export function evaluateMilestones(
  p: MetaProfile, s: RunEndSummary,
): { profile: MetaProfile; unlocked: UnlockTarget[] } {
  let profile = p
  const unlocked: UnlockTarget[] = []
  for (const m of MILESTONES) {
    if (profile.milestones[m.id]) continue
    if (!m.when(s)) continue
    profile = { ...profile, milestones: { ...profile.milestones, [m.id]: true } }
    profile = m.unlock.kind === 'wizard'
      ? unlockWizard(profile, m.unlock.id)
      : unlockRelic(profile, m.unlock.id)
    unlocked.push(m.unlock)
  }
  return { profile, unlocked }
}

export function recordRunEnd(
  p: MetaProfile, s: RunEndSummary,
): { profile: MetaProfile; earned: number; unlocked: UnlockTarget[] } {
  const earned = earnCioccorane(s)
  let profile = grantCioccorane(p, earned)
  const usage = { ...profile.stats.wizardUsage }
  for (const id of s.teamWizardIds) usage[id] = (usage[id] ?? 0) + 1
  profile = {
    ...profile,
    stats: {
      ...profile.stats,
      runsPlayed: profile.stats.runsPlayed + 1,
      runsWon: profile.stats.runsWon + (s.outcome === 'win' ? 1 : 0),
      bossesKilled: profile.stats.bossesKilled + s.bossesDefeated,
      bestStageReached: Math.max(profile.stats.bestStageReached, s.areasCleared),
      wizardUsage: usage,
    },
  }
  const evalResult = evaluateMilestones(profile, s)
  return { profile: evalResult.profile, earned, unlocked: evalResult.unlocked }
}
