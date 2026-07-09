import { describe, it, expect } from 'vitest'
import {
  startRunB, starterOffer, chooseStarters, reachable, moveTo, resolveCurrent,
  registerCoreResolvers, useConsumableRelic, setWizardSpell,
} from '@/game/engine/runEngine'
import { advanceEndlessArea, globalFloor } from '@/game/engine/endless'
import { recruitOffer, relicOffer } from '@/game/engine/resolvers/recruit'
import { eventResolver } from '@/game/engine/resolvers/event'
import { createRng } from '@/game/engine/rng'
import { powerOf } from '@/game/engine/combat/teamGen'
import { isDead } from '@/game/engine/roster'
import { spellIsOffensive } from '@/game/engine/statRoll'
import { normalizeSpell } from '@/game/engine/combat/normalizeSpell'
import { SPELL_BY_ID } from '@/data/spells'
import type { DraftedWizard, RunNode, RunState, Spell } from '@/types'

// Endless difficulty calibration (near-optimal bot, death-floor distribution). Method
// mirrors tests/engine/campaignBalanceB.test.ts: same greedy fight-first policy (draft
// starters -> repeatedly pick reachable node -> resolve -> advance on boss clear), ported
// to drive an ENDLESS run (advanceEndlessArea instead of clearAreaAndAdvance, so the run
// never terminates in 'win') until the team is wiped. globalFloor(state) at wipeout is the
// death-floor. BALANCE.endless.levelPerFloor (data/constants.ts) is the sole calibration
// lever swept here — it scales enemy level linearly per global floor (endlessEnemyLevel,
// game/engine/combat/threat.ts), UNCAPPED past campaign's levelMax.
//
// *** Wiring gap fixed alongside this calibration (2026-07-09) *** `generateArea`
// (game/engine/map.ts) pre-generates every combat node's NodeBattle via
// `buildBattlePackage`, but its call site never forwarded the caller's `endless` flag —
// so EVERY node (including ones reached from `advanceEndlessArea`) silently defaulted to
// the CAPPED campaign level formula (`enemyLevelFor`), and `levelPerFloor` had ZERO
// effect on any real or test-driven run. `resolvers/combat.ts`'s `state.endless`-aware
// fallback (`node.battle ?? buildBattlePackage(..., state.endless)`) never actually ran,
// because `node.battle` is always pre-populated. Fixed by threading an `endless` param
// through `generateArea(rng, seed, area, bias, endless = false)` into its
// `buildBattlePackage` call, and passing `true` from `advanceEndlessArea`. Default
// `false` preserves every existing (campaign) call site's behavior exactly — verified via
// full typecheck + suite run. Without this fix, this task's core deliverable (measuring
// levelPerFloor's effect) is not measurable at all: the sweep below was IDENTICAL
// (bit-for-bit) across every candidate before the fix.
//
// Calibration sweep (2026-07-09, 60 seeds `endless-0..59`, median/p90 death-floor).
// floorsPerArea=5, so floor 14 = area-2's boss (Voldemort, the scripted final-boss squad
// that recurs every area >= 2 in Endless via isFinalBoss's `area >= areas-1` check) — a
// STRUCTURAL cliff, not a smooth dial: for levelPerFloor in [0.18, 1.5] the median is
// PINNED at exactly 14 regardless of k (Voldemort's fixed budget/hpMult/unitCount, not the
// per-floor level slope, dominates once enough floors have accumulated level by floor 14).
// The brief's requested candidates (0.5/0.75/1/1.5) all land ON this cliff (median=14,
// fails the >=15 floor) — reported honestly, then swept further down to find where the
// bot escapes the wall:
//   levelPerFloor=1.50 -> median=12, p90=14   (cliff; p90≈median, hard wall)
//   levelPerFloor=1.00 -> median=14, p90=19   (cliff)
//   levelPerFloor=0.75 -> median=14, p90=24   (cliff)
//   levelPerFloor=0.50 -> median=14, p90=41   (cliff)
//   levelPerFloor=0.25 -> median=14, p90=58   (cliff)
//   levelPerFloor=0.20 -> median=14, p90=58   (cliff)
//   levelPerFloor=0.18 -> median=14, p90=58   (cliff)
//   levelPerFloor=0.15 -> median=19, p90=61   (escapes the wall; passes)
//   levelPerFloor=0.10 -> median=21, p90=63   (passes; comfortable margin both sides)
//   levelPerFloor=0.08 -> median=21, p90=61   (passes)
//   levelPerFloor=0.05 -> median=21, p90=61   (passes)
//   levelPerFloor=0.02 -> median=22, p90=63   (passes)
//   levelPerFloor=0.00 -> median=22, p90=63   (passes; enemy level frozen at floor-0 base)
// The 0.15->0.18 boundary is a sharp threshold (not gradual): a small level increase by
// floor 14 is enough to flip a large fraction of seeds from "clear the boss" to "wiped by
// the boss". SHIPPED: levelPerFloor=0.10 — centered in the [15,40] target window (not
// hugging either edge, unlike the fragile 1-seed margins common in campaignBalanceB's
// history) and p90=63 is a strong ~3x long tail for a skilled/lucky run. Area-2-boss
// (Voldemort)'s own budget/hpMult/unitCount is now a floor-sensitive lever for ENDLESS
// too (in addition to campaignBalanceB, which it already was): any future change must
// re-run this sweep.
registerCoreResolvers()

const SEEDS = Array.from({ length: 60 }, (_, i) => `endless-${i}`)
const SAFETY_CAP_FLOOR = 500

// Same near-optimal ("upper-bound") policy as campaignBalanceB.test.ts's pickNode: build a
// functional core, heal before pressing on, fight for EXP, fill the roster, grab relics.
function pickNode(s: RunState): RunNode {
  const opts = reachable(s)
  if (s.team.length < 3) { const r = opts.find(n => n.type === 'recruit'); if (r) return r }
  const wounded = s.team.some(dw => (dw.currentHp ?? dw.maxHp) < dw.maxHp)
  const infirmary = opts.find(n => n.type === 'infirmary')
  if (wounded && infirmary) return infirmary
  const fight = opts.find(n => n.type === 'elite') ?? opts.find(n => n.type === 'battle')
  if (fight) return fight
  if (s.team.length < (s.teamMax ?? 5)) { const r = opts.find(n => n.type === 'recruit'); if (r) return r }
  if (s.relics.length < 3) { const r = opts.find(n => n.type === 'relic'); if (r) return r }
  return opts.find(n => n.type === 'boss') ?? opts[0]!
}

// Spell-optimization layer, ported verbatim from campaignBalanceB.test.ts: a human
// player equips each wizard's strongest attack spell rather than leaving the rng-picked
// default. This is NOT optional flavor — campaignBalanceB's history shows the default
// spell is often too weak to be a realistic "near-optimal" proxy (see that file's
// 2026-07-04 "Spell-optimization experiment" note).
function spellDamagePower(spell: Spell): number {
  return normalizeSpell(spell).filter(e => e.kind === 'damage').reduce((sum, e) => sum + e.power, 0)
}

function strongestAttackSpellId(dw: DraftedWizard): string | undefined {
  let bestId: string | undefined
  let bestPower = -Infinity
  for (const id of dw.wizard.spellPool) {
    const spell = SPELL_BY_ID[id]
    if (!spell || !spellIsOffensive(spell)) continue
    const power = spellDamagePower(spell)
    if (power > bestPower) { bestPower = power; bestId = id }
  }
  return bestId
}

function optimizeTeamSpells(state: RunState): RunState {
  let s = state
  for (const dw of s.team) {
    const id = strongestAttackSpellId(dw)
    if (!id || dw.spell.id === id) continue
    s = setWizardSpell(s, dw.wizard.id, id)
  }
  return s
}

/** Drive a near-optimal greedy Endless run (same policy as campaignBalanceB's runOne)
 *  until the team wipes. Returns globalFloor(state) at wipeout — the death-floor. A hard
 *  safety cap (SAFETY_CAP_FLOOR) guards against a hypothetically-unkillable bot looping
 *  forever; if hit, the cap itself is returned. */
function endlessDeathFloor(seed: string): number {
  let s = startRunB(seed)
  s = { ...s, endless: true }
  const offer = starterOffer(seed, 'Grifondoro')
  const starters = [...offer].sort((a, b) => powerOf(b) - powerOf(a)).slice(0, 3).map(d => d.wizard.id)
  s = chooseStarters(s, 'Grifondoro', starters, createRng(seed))
  s = { ...s, endless: true }
  s = optimizeTeamSpells(s)

  let guard = 0
  while (guard++ < 5000) {
    if (globalFloor(s) >= SAFETY_CAP_FLOOR) return SAFETY_CAP_FLOOR
    if (s.phase === 'defeat') return globalFloor(s)
    if (s.phase === 'map') { s = moveTo(s, pickNode(s).id); continue }
    const node = s.map!.find(n => n.id === s.currentNodeId)!
    const rng = createRng(seed).fork(2).fork(s.area ?? 0)
    if (s.phase === 'battle') {
      if (s.team.some(dw => isDead(dw))) {
        const reviveRelic = s.relics.find(a => a.relic.active === 'revive')
        if (reviveRelic) s = useConsumableRelic(s, reviveRelic.relic.id)
      }
      s = resolveCurrent(s, { kind: 'combat-ack' }, rng)
      continue
    }
    if (s.phase === 'recruit-node') {
      const off = recruitOffer(s, node, createRng(seed))
      const best = [...off].sort((a, b) => powerOf(b) - powerOf(a))[0]!
      const full = s.team.length >= (s.teamMax ?? 5)
      const replaceId = full ? [...s.team].sort((a, b) => powerOf(a) - powerOf(b))[0]!.wizard.id : undefined
      s = resolveCurrent(s, { kind: 'recruit-pick', wizardId: best.wizard.id, replaceId }, createRng(seed))
      s = optimizeTeamSpells(s)
      s = { ...s, phase: 'map' }; continue
    }
    if (s.phase === 'relic-node') {
      const off = relicOffer(s, node, createRng(seed))
      s = resolveCurrent(s, { kind: 'relic-pick', relicId: off[0]!.id }, createRng(seed))
      s = { ...s, phase: 'map' }; continue
    }
    if (s.phase === 'infirmary-node') {
      s = resolveCurrent(s, { kind: 'combat-ack' }, createRng(seed))
      s = { ...s, phase: 'map' }; continue
    }
    // 'area-cleared' fires while area < BALANCE.map.areas-1; once the run crosses the
    // campaign's own last-area boundary, resolveCurrent's phaseAfterNode (which is not
    // endless-aware) emits 'win' instead. Both are area boundaries in Endless: always
    // advance via advanceEndlessArea (infinite; never actually terminates the run).
    if (s.phase === 'area-cleared' || s.phase === 'win') { s = advanceEndlessArea(s, createRng(seed)); continue }
    if (s.phase === 'victory') { s = { ...s, phase: 'map' }; continue }
    if (s.phase === 'event-node') {
      const entry = eventResolver.enter(s, node, createRng(seed))
      const optionId = entry.event!.choices[0]!.id
      s = resolveCurrent(s, { kind: 'event-choice', optionId }, createRng(seed))
      s = { ...s, phase: 'map' }; continue
    }
    break
  }
  return globalFloor(s)
}

describe('endless scaling calibration', () => {
  const rawFloors = SEEDS.map(endlessDeathFloor)
  const floors = [...rawFloors].sort((a, b) => a - b)
  const median = floors[Math.floor(floors.length / 2)]!
  const p90 = floors[Math.floor(floors.length * 0.9)]!

  // eslint-disable-next-line no-console
  console.log(`[endlessScaling] N=${SEEDS.length} median=${median} p90=${p90} `
    + `min=${floors[0]} max=${floors[floors.length - 1]}`)

  it('median death-floor sits in a healthy window with a long tail', () => {
    // Healthy: typical death mid-run, skilled/lucky tail goes much deeper (graded curve,
    // not a hard wall). BALANCE.endless.levelPerFloor is floor-sensitive: any future
    // change to endless enemy scaling must re-run this sweep.
    expect(median).toBeGreaterThanOrEqual(15)
    expect(median).toBeLessThanOrEqual(40)
    expect(p90).toBeGreaterThan(median)
  })

  it('is deterministic (same seeds -> same death-floors)', () => {
    const again = SEEDS.map(endlessDeathFloor)
    expect(again).toEqual(rawFloors)
  })
})
