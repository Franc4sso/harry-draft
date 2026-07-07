import type { DraftedWizard, Wizard } from '@/types'
import type { Rng } from '../rng'
import type { BossDef } from '@/data/bosses'
import { BALANCE } from '@/data/constants'
import { WIZARDS } from '@/data/wizards'
import { SPELL_BY_ID } from '@/data/spells'
import { draftWizard, guaranteeOffensiveSpell, spellIsOffensive } from '../statRoll'
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
 *  themed draft so both anchor difficulty to the same window.
 *
 *  `excludeSupporto` (enemy elite/boss drafts only): a Supporto is clamped to never
 *  hold an attack (guaranteeOffensiveSpell → Cura), so it can never satisfy the
 *  "no harmless boss/elite enemy" invariant (attackMoveGuarantee.test.ts). Drafting one
 *  onto an elite/boss squad would field a unit that deals zero damage — a free win.
 *  So those drafts exclude Supporto from the candidate pool entirely (normal packs and
 *  player drafts keep Supporto — they have no such invariant). */
export function budgetWindow(targetPer: number, count: number, excludeSupporto = false): Wizard[] {
  const eligible = excludeSupporto ? WIZARDS.filter(w => w.role !== 'Supporto') : WIZARDS
  const sorted = [...eligible].sort((a, b) => expectedPower(a as Wizard) - expectedPower(b as Wizard))
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

function pickTowardBudget(
  rng: Rng, targetPer: number, count: number, preferOffense = false, guaranteeOffense = false,
): DraftedWizard[] {
  // guaranteeOffense (elite/boss) ⇒ exclude Supporto: a Supporto can never be offensive
  // (clamped to Cura), so it must not be fielded where the no-harmless-enemy invariant holds.
  const window = budgetWindow(targetPer, count, guaranteeOffense)
  const pool = rng.shuffle(window)
  const out: DraftedWizard[] = []
  for (const w of pool) out.push(draftWizard(rng, w as Wizard, false, preferOffense, guaranteeOffense))
  return out.sort((a, b) => powerOf(b) - powerOf(a)).slice(0, count)
}

export function generateEnemyTeam(rng: Rng, targetBudget: number): DraftedWizard[] {
  const perUnit = targetBudget / BALANCE.draft.teamSize
  return pickTowardBudget(rng, perUnit, BALANCE.draft.teamSize)
}

export function generateBossTeam(rng: Rng, boss: BossDef): DraftedWizard[] {
  // Every boss fights with at least 3 units (hard design rule — a boss squad must never
  // feel scrawnier than a regular pack) and NEVER more than maxEnemies (user directive:
  // max 5 avversari, bosses included). `boss.unitCount` sits between those bounds.
  const size = Math.min(BALANCE.campaignB.maxEnemies, Math.max(3, boss.unitCount ?? BALANCE.draft.teamSize))
  const perUnit = boss.budget / size
  // Every boss unit (not just the leader) gets the strict offensive guarantee: a
  // boss/elite enemy that can never damage the player is a free win (see
  // guaranteeOffensiveSpell in statRoll.ts).
  const team = pickTowardBudget(rng, perUnit, size, true, true)
  let leader: DraftedWizard
  if (boss.bossWizardId) {
    const named = WIZARDS.find(w => w.id === boss.bossWizardId)
    if (!named) throw new Error(`boss.bossWizardId not found: ${boss.bossWizardId}`)
    let idx = team.findIndex(d => d.wizard.id === boss.bossWizardId)
    if (idx < 0) {
      // replace the weakest unit with the guaranteed boss
      const weakest = team.reduce((w, d, i) => (powerOf(d) < powerOf(team[w]!) ? i : w), 0)
      team[weakest] = draftWizard(rng, named as Wizard, false, true, true)
      idx = weakest
    }
    leader = team[idx]!
  } else {
    leader = team.reduce((best, d) => (powerOf(d) > powerOf(best) ? d : best), team[0]!)
  }
  leader.stats = { ...leader.stats, hp: Math.round(leader.stats.hp * boss.hpMult) }
  leader.maxHp = leader.stats.hp
  const forced = boss.forcedSpellIds?.[0]
  if (forced && SPELL_BY_ID[forced]) leader.spell = SPELL_BY_ID[forced]!
  // The forced-spell override runs AFTER the per-unit guarantee above, so re-check:
  // a forced spell that happens to be non-offensive must not undo the guarantee.
  if (!spellIsOffensive(leader.spell)) leader.spell = guaranteeOffensiveSpell(leader.wizard, leader.spell)
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
  // Elite/boss packs get the strict offensive guarantee, so they must exclude Supporto
  // (which can never be offensive — clamped to Cura); normal packs keep Supporto.
  const excludeSupporto = kind === 'elite' || kind === 'boss'
  // Power-sorted ascending so weightedPick favors the stronger end of the window.
  const window = [...budgetWindow(perUnit, count, excludeSupporto)]
    .sort((a, b) => expectedPower(a) - expectedPower(b))

  const strength = themeStrengthFor(area, kind)
  const themeRng = rng.fork(1)

  // Elite packs must ALWAYS field an active synergy (design rule: elite = a themed,
  // coordinated squad). Force ≥2 themed members drawn from a HOUSE or ROLE theme —
  // those activate at their 2-member tier, unlike tag themes (weasley/order/… need 3).
  // Regular/boss packs keep the softer, strength-scaled theming.
  const forceSynergy = kind === 'elite'
  const eligible = (t: Theme) => !forceSynergy || t.id.startsWith('house:') || t.id.startsWith('role:')
  const minMembers = forceSynergy ? 2 : 0

  // Pick a realizable theme: try themes in turn until one has ≥2 members in the
  // budget window (so the synergy promise is always fulfillable). Fall back to
  // mixed if no theme can be realized (strength 0 or tiny pool at this budget).
  let realized: Theme | null = null
  if (strength > 0 || forceSynergy) {
    const triedIds: string[] = [...excludeThemes]
    const maxAttempts = forceSynergy ? 24 : 10
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const candidate = pickTheme(themeRng, triedIds)
      if (!candidate) break
      if (!eligible(candidate)) { triedIds.push(candidate.id); continue }
      const candidateThemed = window.filter(w => candidate.matches(w))
      const candidateWant = Math.min(Math.max(minMembers, targetThemeMembers(strength, count)), candidateThemed.length)
      if (candidateWant >= 2) { realized = candidate; break }
      triedIds.push(candidate.id)
    }
  }

  // Members of the window that realize the theme.
  const themed = realized ? window.filter(w => realized!.matches(w)) : []
  const wantThemed = realized ? Math.min(Math.max(minMembers, targetThemeMembers(strength, count)), themed.length) : 0

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

  // Enemy packs prefer offensive spells so they actually deal damage (a squad of
  // passive supports/controllers that never attacks feels toothless). Elite/boss packs
  // get the STRICT guarantee on top: a degenerate zero-damage elite/boss enemy is a
  // free win, so those kinds can never end up with a non-offensive active.
  const guaranteeOffense = kind === 'elite' || kind === 'boss'
  const team = chosen.map(w => draftWizard(drawRng, w, false, true, guaranteeOffense))
  return { team, themeId: realized ? realized.id : null }
}
