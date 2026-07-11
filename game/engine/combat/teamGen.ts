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
 *  Supporto is NOT excluded here (USER DECISION 2026-07-07, Task 3c): enemy elite/boss
 *  teams may field up to 1 Supporto, and guaranteeOffensiveSpell now falls back to
 *  `base_attack` for every role, so a fielded Supporto still threatens like any other
 *  unit (see statRoll.ts). The ≤1-Supporto cap and role-variety guarantee are enforced
 *  downstream after the team is drawn (see `capSupporto`), so this window stays uniform. */
export function budgetWindow(targetPer: number, count: number, spanMult = 3): Wizard[] {
  const sorted = [...WIZARDS].sort((a, b) => expectedPower(a as Wizard) - expectedPower(b as Wizard))
  const n = sorted.length
  const minBudget = BALANCE.campaign.baseBudget / BALANCE.draft.teamSize
  const maxBudget =
    (BALANCE.campaign.baseBudget + BALANCE.campaign.difficultySpan * BALANCE.campaign.budgetStep) /
    BALANCE.draft.teamSize
  const t = Math.min(1, Math.max(0, (targetPer - minBudget) / Math.max(1, maxBudget - minBudget)))
  const centerIdx = Math.round(t * (n - 1))
  // Window spans `count * spanMult` wizards. Default spanMult=3 is the tight, difficulty-
  // anchored window the legacy draft + boss path rely on. themedEnemyTeam passes a much
  // larger spanMult (derived from BALANCE.campaignB.varietyWindowSize) so normal/elite packs
  // draw from a wide slice of the roster instead of recycling the same ~9 weakest wizards — the budget
  // percentile floors at index 0 in the live loop (per-unit budget << minBudget), so without
  // this the window collapses to `sorted.slice(0, count*3)` every single fight. Difficulty is
  // carried by enemy LEVEL (leveledStats), not by which wizard is drawn, so widening trades
  // pure variety for a small, measured base-power shift (see campaignBalanceB / _probeVariety).
  const span = Math.min(n, count * spanMult)
  const half = Math.floor(span / 2)
  const start = Math.max(0, Math.min(n - span, centerIdx - half))
  return sorted.slice(start, start + span) as Wizard[]
}

/** Enforces "≤1 Supporto, alongside other roles" (enemy elite/boss only, USER DECISION
 *  2026-07-07): if the drafted `team` has ≥2 Supporto, keep the strongest one and
 *  replace every extra with the next-best NON-Supporto candidate from `window`
 *  (deterministic — reuses the rng that's already threaded through, no fresh draw
 *  source). `window` must be the same pool the team was drawn from, so replacements
 *  stay power-consistent with what was already on offer. */
function capSupporto(
  rng: Rng, team: DraftedWizard[], window: Wizard[], preferOffense: boolean, guaranteeOffense: boolean,
): DraftedWizard[] {
  const supportoSlots = team
    .map((d, i) => ({ d, i }))
    .filter(({ d }) => d.wizard.role === 'Supporto')
  if (supportoSlots.length <= 1) return team

  // Keep the strongest Supporto; replace the rest.
  const byPowerDesc = [...supportoSlots].sort((a, b) => powerOf(b.d) - powerOf(a.d))
  const replaceIdxs = byPowerDesc.slice(1).map(x => x.i)

  const usedIds = new Set(team.map(d => d.wizard.id))
  const candidates = window
    .filter(w => w.role !== 'Supporto' && !usedIds.has(w.id))
    .sort((a, b) => expectedPower(b) - expectedPower(a))

  const out = [...team]
  let ci = 0
  for (const idx of replaceIdxs) {
    const replacement = candidates[ci]
    ci += 1
    if (!replacement) continue // window exhausted — leave the extra Supporto rather than shrink the team
    out[idx] = draftWizard(rng, replacement, false, preferOffense, guaranteeOffense)
    usedIds.add(replacement.id)
  }
  return out
}

function pickTowardBudget(
  rng: Rng, targetPer: number, count: number, preferOffense = false, guaranteeOffense = false,
): DraftedWizard[] {
  const window = budgetWindow(targetPer, count)
  const pool = rng.shuffle(window)
  const out: DraftedWizard[] = []
  for (const w of pool) out.push(draftWizard(rng, w as Wizard, false, preferOffense, guaranteeOffense))
  const team = out.sort((a, b) => powerOf(b) - powerOf(a)).slice(0, count)
  // Elite/boss (guaranteeOffense) ⇒ cap Supporto at ≤1 so the fielded roster keeps role
  // variety (USER DECISION 2026-07-07: Supporto may appear, but never dominate/mono-field).
  return guaranteeOffense ? capSupporto(rng, team, window, preferOffense, guaranteeOffense) : team
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
 *  ascending) entries are more likely. Weight of the i-th entry (0-based) is
 *  `(i+1)**bias`. `bias=1` is the original linear rank weighting (top of the window
 *  dominates); `bias→0` flattens toward uniform (every wizard in the window roughly
 *  equally likely — the variety lever, so a WIDE window actually surfaces its members
 *  instead of always re-drawing its strongest few); `bias<0` would favor the weak end.
 *  Deterministic. */
function weightedPick<T>(rng: Rng, arr: T[], bias = 1): T {
  if (bias === 1) {
    // Fast path preserves the exact original draw sequence (and thus every existing seed).
    const totalWeight = (arr.length * (arr.length + 1)) / 2
    let r = rng.next() * totalWeight
    for (let i = 0; i < arr.length; i++) {
      r -= i + 1
      if (r <= 0) return arr[i]!
    }
    return arr[arr.length - 1]!
  }
  let total = 0
  for (let i = 0; i < arr.length; i++) total += (i + 1) ** bias
  let r = rng.next() * total
  for (let i = 0; i < arr.length; i++) {
    r -= (i + 1) ** bias
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
  const cb = BALANCE.campaignB
  const bias = cb.varietyWeightBias
  const perUnit = budget / BALANCE.draft.teamSize
  // Power-sorted ascending so weightedPick favors the stronger end of the window.
  // Supporto is included (USER DECISION 2026-07-07): elite/boss packs cap it at ≤1 after
  // drafting (see capSupporto below), rather than excluding it from the window up front.
  // varietyWindowSize widens the candidate slice far beyond the legacy count*3 so normal/elite
  // packs stop recycling the same ~9 weakest wizards (see budgetWindow); varietyWeightBias
  // flattens the pick so that wide window's members actually appear. The window is an ABSOLUTE
  // wizard count, so we back out the count-relative spanMult budgetWindow expects (floored at 3
  // = the legacy width) to keep normal (3) and elite (5) packs on an even-size, even-power pool.
  const spanMult = Math.max(3, Math.ceil(cb.varietyWindowSize / Math.max(1, count)))
  const window = [...budgetWindow(perUnit, count, spanMult)]
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
      const w = weightedPick(drawRng, avail, bias)
      chosen.push(w); used.add(w.id)
      avail = avail.filter(x => x.id !== w.id)
    }
  }
  // Fill the rest from the whole window (excluding already-picked), weighted.
  let rest = window.filter(w => !used.has(w.id))
  while (chosen.length < count && rest.length > 0) {
    const w = weightedPick(drawRng, rest, bias)
    chosen.push(w); used.add(w.id)
    rest = rest.filter(x => x.id !== w.id)
  }

  // Enemy packs prefer offensive spells so they actually deal damage (a squad of
  // passive supports/controllers that never attacks feels toothless). Elite/boss packs
  // get the STRICT guarantee on top: a degenerate zero-damage elite/boss enemy is a
  // free win, so those kinds can never end up with a non-offensive active.
  const guaranteeOffense = kind === 'elite' || kind === 'boss'
  const draftedTeam = chosen.map(w => draftWizard(drawRng, w, false, true, guaranteeOffense))
  // Elite/boss ⇒ cap Supporto at ≤1 (USER DECISION 2026-07-07: keep role variety, never a
  // mono/heavy-Supporto squad). window still holds the full candidate pool for replacements.
  const team = guaranteeOffense ? capSupporto(drawRng, draftedTeam, window, true, guaranteeOffense) : draftedTeam
  return { team, themeId: realized ? realized.id : null }
}
