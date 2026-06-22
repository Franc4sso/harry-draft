import type { DraftedWizard, Wizard } from '@/types'
import type { Rng } from '../rng'
import type { BossDef } from '@/data/bosses'
import { BALANCE } from '@/data/constants'
import { WIZARDS } from '@/data/wizards'
import { SPELL_BY_ID } from '@/data/spells'
import { draftWizard } from '../statRoll'

export function powerOf(dw: DraftedWizard): number {
  const s = dw.stats
  return s.hp + s.atk * 2 + s.def * 1.5 + s.spd
}

export function budgetForStage(stage: number): number {
  return BALANCE.campaign.baseBudget + stage * BALANCE.campaign.budgetStep
}

/** Median expected power for a wizard given its stat ranges. */
function expectedPower(w: Wizard): number {
  const [hlo, hhi] = w.ranges.hp
  const [alo, ahi] = w.ranges.atk
  const [dlo, dhi] = w.ranges.def
  const [slo, shi] = w.ranges.spd
  return (hlo + hhi) / 2 + ((alo + ahi) / 2) * 2 + ((dlo + dhi) / 2) * 1.5 + (slo + shi) / 2
}

function pickTowardBudget(rng: Rng, targetPer: number, count: number): DraftedWizard[] {
  // Sort all wizards by expected power ascending.
  const sorted = [...WIZARDS].sort((a, b) => expectedPower(a as Wizard) - expectedPower(b as Wizard))
  const n = sorted.length
  // Map targetPer to a rank: how many wizards should be "weaker" than what we want.
  // We use a logistic mapping so larger budgets always select from higher-ranked wizards.
  // Reference budget range from constants:
  const minBudget = BALANCE.campaign.baseBudget / BALANCE.draft.teamSize   // ~300
  const maxBudget = (BALANCE.campaign.baseBudget + 10 * BALANCE.campaign.budgetStep) / BALANCE.draft.teamSize // ~740
  // Clamp and normalize targetPer to [0,1].
  const t = Math.min(1, Math.max(0, (targetPer - minBudget) / Math.max(1, maxBudget - minBudget)))
  // Map to wizard rank index: t=0 → pick from bottom, t=1 → pick from top.
  // Center of window to select from.
  const centerIdx = Math.round(t * (n - 1))
  // Window of count*3 candidates centered at centerIdx.
  const half = Math.floor((count * 3) / 2)
  const start = Math.max(0, Math.min(n - count * 3, centerIdx - half))
  const window = sorted.slice(start, start + count * 3)
  // Shuffle the window for randomness, draft all, pick top `count` by power.
  const pool = rng.shuffle(window)
  const out: DraftedWizard[] = []
  for (const w of pool) {
    out.push(draftWizard(rng, w as Wizard))
  }
  return out.sort((a, b) => powerOf(b) - powerOf(a)).slice(0, count)
}

export function generateEnemyTeam(rng: Rng, targetBudget: number): DraftedWizard[] {
  const perUnit = targetBudget / BALANCE.draft.teamSize
  return pickTowardBudget(rng, perUnit, BALANCE.draft.teamSize)
}

export function generateBossTeam(rng: Rng, boss: BossDef): DraftedWizard[] {
  const perUnit = boss.budget / BALANCE.draft.teamSize
  const team = pickTowardBudget(rng, perUnit, BALANCE.draft.teamSize)
  const leader = team.reduce((best, d) => (powerOf(d) > powerOf(best) ? d : best), team[0]!)
  leader.stats = { ...leader.stats, hp: Math.round(leader.stats.hp * boss.hpMult) }
  leader.maxHp = leader.stats.hp
  const forced = boss.forcedSpellIds?.[0]
  if (forced && SPELL_BY_ID[forced]) leader.spell = SPELL_BY_ID[forced]!
  return team
}
