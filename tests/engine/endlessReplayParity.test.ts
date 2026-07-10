import { describe, it, expect } from 'vitest'
import {
  startRunB, starterOffer, chooseStarters, reachable, moveTo, resolveCurrent,
  registerCoreResolvers, useConsumableRelic, combatRngForNode,
} from '@/game/engine/runEngine'
import { advanceEndlessArea, scoreForEndlessRun, globalFloor } from '@/game/engine/endless'
import { recruitOffer, relicOffer } from '@/game/engine/resolvers/recruit'
import { eventResolver } from '@/game/engine/resolvers/event'
import { createRng } from '@/game/engine/rng'
import { powerOf } from '@/game/engine/combat/teamGen'
import { isDead } from '@/game/engine/roster'
import { replayRun, ENGINE_VERSION, type RunLog, type PlayerAction } from '@/game/engine/endlessReplay'
import type { RunNode, RunState } from '@/types'

// CRITICAL regression gate for the replay combat RNG mismatch (final whole-branch review,
// defect 1): live combat resolves with combatRngForNode(seed, nodeId) (== the fork chain
// hooks/useRunB.combat.ts's combatRng and hooks/useRunShared.ts's commitBattle use), but
// replayRun used to resolve EVERY resolve action — combat included — with the raw seed rng.
// Combat draws crits/dodges from its rng, so a replayed fight could diverge from the
// original: 6/19 reviewer-tested seeds produced a DIFFERENT score on replay, sometimes
// HIGHER (a player could resubmit and bank a score they never earned) — breaking
// anti-cheat-by-construction (the entire point of replayRun).
//
// This test drives a real endless run to wipeout with the SAME near-optimal greedy policy
// endlessScaling.test.ts uses (battle-first, heal when wounded, fill roster, grab relics),
// but additionally RECORDS every action into a RunLog exactly the way hooks/useEndless.ts's
// wrapped callbacks do (same action shapes, same order, same rng choice per action kind:
// combatRngForNode for battle/elite/boss, raw createRng(seed) for everything else — mirrors
// useRunShared.ts's commitBattle vs chooseRecruit/chooseRelic/ackInfirmary/
// chooseEventOption/chooseSpellUpgrade split). It then decodes/replays that log via
// replayRun and asserts the replayed state is valid AND its score matches the played score,
// for every seed.
registerCoreResolvers()

const SEEDS = Array.from({ length: 20 }, (_, i) => `parity-${i}`)

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

/** Drive a real endless run to wipeout, RECORDING a RunLog exactly as hooks/useEndless.ts
 *  would (action shapes/order identical to its wrapped callbacks), and using the SAME rng
 *  per action kind hooks/useRunShared.ts's callbacks use (combatRngForNode for combat,
 *  raw createRng(seed) otherwise). Returns the played score (scoreForEndlessRun at wipeout)
 *  and the RunLog a real getChallengeCode() would have produced for this run. */
function playAndRecord(seed: string): { playedScore: number; log: RunLog } {
  const house = 'Grifondoro' as const
  const offer = starterOffer(seed, house)
  const starterIds = [...offer].sort((a, b) => powerOf(b) - powerOf(a)).slice(0, 3).map(d => d.wizard.id)
  const actions: PlayerAction[] = []

  let s: RunState = { ...startRunB(seed), endless: true }
  s = chooseStarters(s, house, starterIds, createRng(seed))
  s = { ...s, endless: true }

  let guard = 0
  while (guard++ < 5000) {
    if (s.phase === 'defeat') break
    if (s.team.length > 0 && s.team.every(dw => (dw.currentHp ?? dw.maxHp) <= 0)) break
    if (s.phase === 'map') {
      const nodeId = pickNode(s).id
      actions.push({ t: 'move', nodeId })
      s = moveTo(s, nodeId)
      continue
    }
    const node = s.map!.find(n => n.id === s.currentNodeId)!
    if (s.phase === 'battle') {
      if (s.team.some(dw => isDead(dw))) {
        const reviveRelic = s.relics.find(a => a.relic.active === 'revive')
        if (reviveRelic) s = useConsumableRelic(s, reviveRelic.relic.id)
      }
      actions.push({ t: 'resolve', choice: { kind: 'combat-ack' } })
      // Combat rng MUST match live play's combatRng(run) / combatRngForNode — this is
      // exactly the fork chain the fix threads into replayRun too.
      s = resolveCurrent(s, { kind: 'combat-ack' }, combatRngForNode(seed, node.id))
      continue
    }
    if (s.phase === 'recruit-node') {
      const off = recruitOffer(s, node, createRng(seed))
      const best = [...off].sort((a, b) => powerOf(b) - powerOf(a))[0]
      if (!best) {
        actions.push({ t: 'resolve', choice: { kind: 'skip' } })
        s = resolveCurrent(s, { kind: 'skip' }, createRng(seed))
      } else {
        const full = s.team.length >= (s.teamMax ?? 5)
        const replaceId = full ? [...s.team].sort((a, b) => powerOf(a) - powerOf(b))[0]!.wizard.id : undefined
        actions.push({ t: 'resolve', choice: { kind: 'recruit-pick', wizardId: best.wizard.id, replaceId } })
        s = resolveCurrent(s, { kind: 'recruit-pick', wizardId: best.wizard.id, replaceId }, createRng(seed))
      }
      s = { ...s, phase: 'map' }; continue
    }
    if (s.phase === 'relic-node') {
      const off = relicOffer(s, node, createRng(seed))
      const relicId = off[0]?.id ?? '__none__'
      actions.push({ t: 'resolve', choice: { kind: 'relic-pick', relicId } })
      s = resolveCurrent(s, { kind: 'relic-pick', relicId }, createRng(seed))
      s = { ...s, phase: 'map' }; continue
    }
    if (s.phase === 'infirmary-node') {
      actions.push({ t: 'resolve', choice: { kind: 'combat-ack' } })
      s = resolveCurrent(s, { kind: 'combat-ack' }, createRng(seed))
      s = { ...s, phase: 'map' }; continue
    }
    if (s.phase === 'area-cleared' || s.phase === 'win') { s = advanceEndlessArea(s, createRng(seed)); continue }
    if (s.phase === 'victory') { s = { ...s, phase: 'map' }; continue }
    if (s.phase === 'event-node') {
      const entry = eventResolver.enter(s, node, createRng(seed))
      const optionId = entry.event!.choices[0]!.id
      actions.push({ t: 'resolve', choice: { kind: 'event-choice', optionId } })
      s = resolveCurrent(s, { kind: 'event-choice', optionId }, createRng(seed))
      s = { ...s, phase: 'map' }; continue
    }
    break
  }

  const log: RunLog = { v: 1, engine: ENGINE_VERSION, seed, house, starterIds, actions }
  return { playedScore: scoreForEndlessRun(s), log }
}

describe('endless replay parity (record -> replay score must match)', () => {
  it('replayed score equals played score for every seed', () => {
    const mismatches: { seed: string; played: number; replayed: number | null; valid: boolean; reason?: string }[] = []
    for (const seed of SEEDS) {
      const { playedScore, log } = playAndRecord(seed)
      const out = replayRun(log)
      const replayedScore = out.valid ? scoreForEndlessRun(out.state) : null
      if (!out.valid || replayedScore !== playedScore) {
        mismatches.push({ seed, played: playedScore, replayed: replayedScore, valid: out.valid, reason: out.reason })
      }
    }
    if (mismatches.length > 0) {
      // eslint-disable-next-line no-console
      console.log('[endlessReplayParity] mismatches:', JSON.stringify(mismatches, null, 2))
    }
    expect(mismatches).toEqual([])
  })

  it('is deterministic (same seed replayed twice yields the same score)', () => {
    for (const seed of SEEDS.slice(0, 5)) {
      const { log } = playAndRecord(seed)
      const a = replayRun(log)
      const b = replayRun(log)
      expect(a.valid).toBe(true)
      expect(b.valid).toBe(true)
      expect(scoreForEndlessRun(a.state)).toBe(scoreForEndlessRun(b.state))
    }
  })
})
