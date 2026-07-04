import { describe, it, expect } from 'vitest'
import {
  startRunB, starterOffer, chooseStarters, reachable, moveTo, resolveCurrent,
  clearAreaAndAdvance, registerCoreResolvers, useConsumableRelic,
} from '@/game/engine/runEngine'
import { recruitOffer, relicOffer } from '@/game/engine/resolvers/recruit'
import { createRng } from '@/game/engine/rng'
import { powerOf } from '@/game/engine/combat/teamGen'
import { isDead } from '@/game/engine/roster'
import { setDraftPoolRestriction } from '@/game/engine/draft'
import { STARTER_WIZARDS } from '@/data/unlocks'
import type { RunNode, RunState } from '@/types'

registerCoreResolvers()

// Near-optimal ("upper-bound") player policy. A pure recruit/relic-first greedy is
// NOT upper-bound: it dodges every fight and reaches each area boss at level 1, so it
// is structurally unwinnable. A competent player builds a functional core, then FIGHTS
// for EXP (the run's only power source), filling the roster and grabbing relics along
// the way. This models the strongest realistic player the band must remain beatable for.
function pickNode(s: RunState): RunNode {
  const opts = reachable(s)
  if (s.team.length < 3) { const r = opts.find(n => n.type === 'recruit'); if (r) return r }
  // Competent play: heal before pressing on. Any wounded or dead wizard, with an
  // infirmary reachable, is worth visiting before another fight — and especially
  // before a boss — the same way a human clicks "heal" instead of walking into a
  // boss room banged up. This never fires away from the (rare, once-per-area)
  // infirmary floor, so it does not turn into infirmary-camping.
  const wounded = s.team.some(dw => (dw.currentHp ?? dw.maxHp) < dw.maxHp)
  const infirmary = opts.find(n => n.type === 'infirmary')
  if (wounded && infirmary) return infirmary
  const fight = opts.find(n => n.type === 'elite') ?? opts.find(n => n.type === 'battle')
  if (fight) return fight
  if (s.team.length < (s.teamMax ?? 5)) { const r = opts.find(n => n.type === 'recruit'); if (r) return r }
  if (s.relics.length < 3) { const r = opts.find(n => n.type === 'relic'); if (r) return r }
  return opts.find(n => n.type === 'boss') ?? opts[0]!
}

// Veleno = the intended counter to the Muro wall (poison bypasses unitDamageReduction).
// The preferVeleno policy variant biases recruit picks to veleno-tagged wizards and relic
// picks to veleno-keyword relics; otherwise it is identical to the near-optimal policy.
function isVeleno(dw: { wizard: { tags?: string[] } }): boolean {
  return (dw.wizard.tags ?? []).includes('veleno')
}

function runOne(seed: string, battleTurns?: number[], preferVeleno = false): 'win' | 'defeat' {
  let s = startRunB(seed)
  const offer = starterOffer(seed, 'Grifondoro')
  const starters = [...offer].sort((a, b) => powerOf(b) - powerOf(a)).slice(0, 3).map(d => d.wizard.id)
  s = chooseStarters(s, 'Grifondoro', starters, createRng(seed))
  let guard = 0
  while (guard++ < 200) {
    if (s.phase === 'win') return 'win'
    if (s.phase === 'defeat') return 'defeat'
    if (s.phase === 'map') { s = moveTo(s, pickNode(s).id); continue }
    const node = s.map!.find(n => n.id === s.currentNodeId)!
    const rng = createRng(seed).fork(2).fork(s.area ?? 0)
    if (s.phase === 'battle') {
      // Competent play: a human with a dead teammate and a revive relic in their
      // bag clicks it before walking into the next fight, not after. Mirrors the
      // real useConsumableRelic hook (components/screens/RunBRunner.tsx's RelicBar).
      if (s.team.some(dw => isDead(dw))) {
        const reviveRelic = s.relics.find(a => a.relic.active === 'revive')
        if (reviveRelic) s = useConsumableRelic(s, reviveRelic.relic.id)
      }
      s = resolveCurrent(s, { kind: 'combat-ack' }, rng)
      if (battleTurns && s.lastBattle) battleTurns.push(s.lastBattle.turns)
      continue
    }
    if (s.phase === 'recruit-node') {
      const off = recruitOffer(s, node, createRng(seed))
      const velenoCand = [...off].filter(isVeleno).sort((a, b) => powerOf(b) - powerOf(a))[0]
      const best = preferVeleno
        ? (velenoCand ?? [...off].sort((a, b) => powerOf(b) - powerOf(a))[0]!)
        : [...off].sort((a, b) => powerOf(b) - powerOf(a))[0]!
      const full = s.team.length >= (s.teamMax ?? 5)
      const replaceId = full ? [...s.team].sort((a, b) => powerOf(a) - powerOf(b))[0]!.wizard.id : undefined
      s = resolveCurrent(s, { kind: 'recruit-pick', wizardId: best.wizard.id, replaceId }, createRng(seed))
      s = { ...s, phase: 'map' }; continue
    }
    if (s.phase === 'relic-node') {
      const off = relicOffer(s, node, createRng(seed))
      const velenoRelic = off.find(r => (r.keywords ?? []).includes('veleno'))
      const chosen = preferVeleno ? (velenoRelic ?? off[0]!) : off[0]!
      s = resolveCurrent(s, { kind: 'relic-pick', relicId: chosen.id }, createRng(seed))
      s = { ...s, phase: 'map' }; continue
    }
    if (s.phase === 'infirmary-node') {
      s = resolveCurrent(s, { kind: 'combat-ack' }, createRng(seed))
      s = { ...s, phase: 'map' }; continue
    }
    if (s.phase === 'area-cleared') { s = clearAreaAndAdvance(s, createRng(seed)); continue }
    if (s.phase === 'victory') { s = { ...s, phase: 'map' }; continue }
    break
  }
  return 'defeat'
}

describe('restricted starter pool is winnable (Reservation 1 gate)', () => {
  const N = 120
  setDraftPoolRestriction(STARTER_WIZARDS)
  const outcomes = Array.from({ length: N }, (_, i) => runOne(`run-${i}`))
  setDraftPoolRestriction(null) // reset so other suites see the full 60
  const winRate = outcomes.filter(o => o === 'win').length / N

  // eslint-disable-next-line no-console
  console.log(`[campaignBalanceRestricted] winRate=${winRate.toFixed(4)}`)

  it('clears the same 0.07 floor as the full-pool harness', () => {
    // RE-TUNED 2026-07-04 ("too easy" hard re-tune): this is the PRIMARY difficulty
    // gate (the meta-layer restricts drafting to this curated starter pool, so this
    // harness — not the full-60-wizard campaignBalanceB — measures what the player
    // actually experiences). Was 0.3083 (too easy) with campaignB.normalEnemyCount=1 /
    // enemyCountByArea=[1,2,4]; raised to normalEnemyCount=3 / enemyCountByArea=[3,4,5]
    // (see data/constants.ts campaignB's comments for the full sweep table), landing
    // at 0.1500 — hard, inside the (0.07, 0.45) guardrail band and close to the
    // 0.10-0.13 aim. Any future campaignB enemy-count change must re-measure this.
    //
    // *** Bot upgraded to competent play 2026-07-04 (heals/infirmary/revive) — see
    // campaignBalanceB.test.ts's matching test for the full writeup of the two
    // policy changes (pickNode now prefers a reachable infirmary over more fighting
    // while wounded/dead; runOne now calls the real useConsumableRelic before a
    // fight when a teammate is dead and a revive relic is held). ***
    // MEASURED on this, the real difficulty gate: winRate=0.1500 (18/120) — BIT-FOR-
    // BIT IDENTICAL to the pre-upgrade lazy bot. Debug instrumentation (not shipped)
    // confirms the new rule is not a no-op here either (it redirects to the
    // infirmary 66 times across these 120 seeds, displacing an already-reachable
    // fight 18 of those times) and that the revive-relic branch never fired (0/120 —
    // no run ever held an active:'revive' relic at the moment a teammate was dead).
    // So contrary to this task's hypothesis, making the bot heal/revive-aware did
    // NOT reveal this harness — the real gate — as "too easy"; the 0.07-0.45 band
    // below (unchanged) already accounts for a competent bot and still holds
    // comfortably. See campaignBalanceB.test.ts for the structural explanation
    // (guaranteed area-clear recovery + enemy stats already tuned hard).
    expect(winRate).toBeGreaterThan(0.07)
    expect(winRate).toBeLessThan(0.45)
  })

  it('is deterministic (same seeds → same outcomes)', () => {
    setDraftPoolRestriction(STARTER_WIZARDS)
    const again = Array.from({ length: N }, (_, i) => runOne(`run-${i}`))
    setDraftPoolRestriction(null)
    expect(again).toEqual(outcomes)
  })
})
