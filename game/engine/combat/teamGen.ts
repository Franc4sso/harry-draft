import type { DraftedWizard, Wizard } from '@/types'
import type { Rng } from '../rng'
import type { BossDef } from '@/data/bosses'
import { BALANCE } from '@/data/constants'
import { WIZARDS } from '@/data/wizards'
import { SPELL_BY_ID } from '@/data/spells'
import { draftWizard } from '../statRoll'
import { pickTheme, themeStrengthFor, targetThemeMembers, type Theme } from './themes'

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

/** The budget-appropriate candidate window: `count*3` wizards centered on the
 *  power-percentile implied by `targetPer`. Shared by the legacy draft and the
 *  themed draft so both anchor difficulty to the same window. */
export function budgetWindow(targetPer: number, count: number): Wizard[] {
  const sorted = [...WIZARDS].sort((a, b) => expectedPower(a as Wizard) - expectedPower(b as Wizard))
  const n = sorted.length
  const minBudget = BALANCE.campaign.baseBudget / BALANCE.draft.teamSize
  const maxBudget =
    (BALANCE.campaign.baseBudget + BALANCE.campaign.difficultySpan * BALANCE.campaign.budgetStep) /
    BALANCE.draft.teamSize
  const t = Math.min(1, Math.max(0, (targetPer - minBudget) / Math.max(1, maxBudget - minBudget)))
  const centerIdx = Math.round(t * (n - 1))
  const half = Math.floor((count * 3) / 2)
  const start = Math.max(0, Math.min(n - count * 3, centerIdx - half))
  return sorted.slice(start, start + count * 3) as Wizard[]
}

function pickTowardBudget(rng: Rng, targetPer: number, count: number): DraftedWizard[] {
  const window = budgetWindow(targetPer, count)
  const pool = rng.shuffle(window)
  const out: DraftedWizard[] = []
  for (const w of pool) out.push(draftWizard(rng, w as Wizard))
  return out.sort((a, b) => powerOf(b) - powerOf(a)).slice(0, count)
}

export function generateEnemyTeam(rng: Rng, targetBudget: number): DraftedWizard[] {
  const perUnit = targetBudget / BALANCE.draft.teamSize
  return pickTowardBudget(rng, perUnit, BALANCE.draft.teamSize)
}

export function generateBossTeam(rng: Rng, boss: BossDef): DraftedWizard[] {
  const size = boss.unitCount ?? BALANCE.draft.teamSize
  const perUnit = boss.budget / size
  const team = pickTowardBudget(rng, perUnit, size)
  const leader = team.reduce((best, d) => (powerOf(d) > powerOf(best) ? d : best), team[0]!)
  leader.stats = { ...leader.stats, hp: Math.round(leader.stats.hp * boss.hpMult) }
  leader.maxHp = leader.stats.hp
  const forced = boss.forcedSpellIds?.[0]
  if (forced && SPELL_BY_ID[forced]) leader.spell = SPELL_BY_ID[forced]!
  return team
}

/** Weighted index into `arr`: stronger (later, since callers pass power-sorted
 *  ascending) entries are more likely. Linear weights by 1-based rank. Deterministic. */
function weightedPick<T>(rng: Rng, arr: T[]): T {
  const totalWeight = (arr.length * (arr.length + 1)) / 2
  let r = rng.next() * totalWeight
  for (let i = 0; i < arr.length; i++) {
    r -= i + 1
    if (r <= 0) return arr[i]!
  }
  return arr[arr.length - 1]!
}

export function themedEnemyTeam(rng: Rng, opts: {
  area: number
  kind: 'normal' | 'elite' | 'boss'
  budget: number
  count: number
  excludeThemes: string[]
}): { team: DraftedWizard[]; themeId: string | null } {
  const { area, kind, budget, count, excludeThemes } = opts
  const perUnit = budget / BALANCE.draft.teamSize
  // Power-sorted ascending so weightedPick favors the stronger end of the window.
  const window = [...budgetWindow(perUnit, count)]
    .sort((a, b) => expectedPower(a) - expectedPower(b))

  const strength = themeStrengthFor(area, kind)
  const themeRng = rng.fork(1)

  // Pick a realizable theme: try themes in turn until one has ≥2 members in the
  // budget window (so the synergy promise is always fulfillable). Fall back to
  // mixed if no theme can be realized (strength 0 or tiny pool at this budget).
  let realized: Theme | null = null
  if (strength > 0) {
    const triedIds: string[] = [...excludeThemes]
    for (let attempt = 0; attempt < 10; attempt++) {
      const candidate = pickTheme(themeRng, triedIds)
      if (!candidate) break
      const candidateThemed = window.filter(w => candidate.matches(w))
      const candidateWant = Math.min(targetThemeMembers(strength, count), candidateThemed.length)
      if (candidateWant >= 2) { realized = candidate; break }
      triedIds.push(candidate.id)
    }
  }

  // Members of the window that realize the theme.
  const themed = realized ? window.filter(w => realized!.matches(w)) : []
  const wantThemed = realized ? Math.min(targetThemeMembers(strength, count), themed.length) : 0

  const chosen: Wizard[] = []
  const used = new Set<string>()
  const drawRng = rng.fork(2)

  if (realized) {
    const pool = themed.filter(w => !used.has(w.id))
    let avail = [...pool]
    for (let i = 0; i < wantThemed && avail.length > 0; i++) {
      const w = weightedPick(drawRng, avail)
      chosen.push(w); used.add(w.id)
      avail = avail.filter(x => x.id !== w.id)
    }
  }
  // Fill the rest from the whole window (excluding already-picked), weighted.
  let rest = window.filter(w => !used.has(w.id))
  while (chosen.length < count && rest.length > 0) {
    const w = weightedPick(drawRng, rest)
    chosen.push(w); used.add(w.id)
    rest = rest.filter(x => x.id !== w.id)
  }

  const team = chosen.map(w => draftWizard(drawRng, w))
  return { team, themeId: realized ? realized.id : null }
}
