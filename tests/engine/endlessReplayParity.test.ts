import { describe, it, expect } from 'vitest'
import {
  startRunB, confirmDraftPicks, reachable, moveTo, resolveCurrent,
  registerCoreResolvers, useConsumableRelic, combatRngForNode, STARTER_PICKS,
} from '@/game/engine/runEngine'
import { startDraft, pickFrom, type DraftSession } from '@/game/engine/draftSession'
import { setDraftPoolRestriction } from '@/game/engine/draft'
import { advanceEndlessArea, scoreForEndlessRun, globalFloor } from '@/game/engine/endless'
import { recruitOffer, relicOffer } from '@/game/engine/resolvers/recruit'
import { eventResolver } from '@/game/engine/resolvers/event'
import { createRng } from '@/game/engine/rng'
import { powerOf } from '@/game/engine/combat/teamGen'
import { isDead, livingOf } from '@/game/engine/roster'
import { detectDuos } from '@/game/engine/duos'
import { replayRun, ENGINE_VERSION, type RunLog, type PlayerAction } from '@/game/engine/endlessReplay'
import type { DraftedWizard, RunNode, RunState } from '@/types'

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

/** Drive a real endless DraftSession (full roster, no house restriction — matches
 *  replayRun's reconstruction) to STARTER_PICKS picks, choosing the highest-power
 *  candidate on each screen. Returns the picked ids (the RunLog's draftPicks) alongside
 *  the session's own picks (DraftedWizard[]) for confirmDraftPicks. */
function draftByPower(seed: string): { draftPicks: string[]; picks: DraftedWizard[] } {
  setDraftPoolRestriction(null)
  let session: DraftSession = startDraft(seed, STARTER_PICKS)
  const draftPicks: string[] = []
  for (let i = 0; i < STARTER_PICKS; i++) {
    const idx = session.current.reduce((best, c, j) => (powerOf(c) > powerOf(session.current[best]!) ? j : best), 0)
    draftPicks.push(session.current[idx]!.wizard.id)
    session = pickFrom(session, idx)
  }
  return { draftPicks, picks: session.picks }
}

/** Drive a real endless run to wipeout, RECORDING a RunLog exactly as hooks/useEndless.ts
 *  would (action shapes/order identical to its wrapped callbacks), and using the SAME rng
 *  per action kind hooks/useRunShared.ts's callbacks use (combatRngForNode for combat,
 *  raw createRng(seed) otherwise). Returns the played score (scoreForEndlessRun at wipeout)
 *  and the RunLog a real getChallengeCode() would have produced for this run. */
function playAndRecord(seed: string): { playedScore: number; log: RunLog } {
  const { draftPicks, picks } = draftByPower(seed)
  const actions: PlayerAction[] = []

  // endless:true must be set BEFORE confirmDraftPicks so area-0 excludes altare —
  // mirrors replayRun's own reconstruction (game/engine/endlessReplay.ts).
  let s: RunState = confirmDraftPicks({ ...startRunB(seed), endless: true }, picks, createRng(seed))

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

  const log: RunLog = { v: 1, engine: ENGINE_VERSION, seed, draftPicks, actions }
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

// Task 9 (Duo Combos verification): the plain SEEDS above are NOT guaranteed to ever field a
// Duo-active player team — detectDuos requires 2 team members sharing a tag (or a matching
// relic), and pickNode/playAndRecord above draft purely by raw power, never by tag. Without a
// Duo-active battle in the recorded log, the replay parity gate above never actually exercises
// the Duo primitives that draw EXTRA rng mid-battle (MIASMA's maybeSpreadPoison,
// UNTORE's maybeSpitPoison) — exactly the kind of rng-stream divergence that caused the
// original combat-replay defect this file's header comment documents. A desync there would
// only ever show up on a run whose recorded log actually contains a Duo-active combat-ack.
//
// Fix: a DEDICATED biased policy (mirrors campaignBalanceB.test.ts's `preferVeleno` pattern)
// that prefers recruits/relics carrying a Duo tag-signal (veleno/esecuzione/scudirigen/
// magieOscure) over the raw-power pick. Otherwise IDENTICAL to playAndRecord above: same
// action shapes/order, same per-action-kind rng split (combatRngForNode for combat, raw
// createRng(seed) otherwise) a real getChallengeCode()/hooks/useEndless.ts run would use.
function preferDuoScore(dw: DraftedWizard): number {
  const tags = dw.wizard.tags ?? []
  const tagHits = ['veleno', 'esecuzione', 'scudirigen', 'magieOscure'].filter(t => tags.includes(t)).length
  const roleHit = dw.wizard.role === 'Supporto' || dw.wizard.role === 'Controllo' || dw.wizard.role === 'Tank' ? 1 : 0
  return tagHits * 1000 + roleHit * 100 + powerOf(dw)
}
function relicLightsADuoSignal(r: { keywords?: string[]; grantsExecute?: unknown; grantsShieldConvert?: unknown; grantsDarkMagic?: unknown }): boolean {
  const kw = r.keywords ?? []
  return kw.includes('veleno') || kw.includes('esecuzione') || kw.includes('scudo') || kw.includes('magieOscure')
    || !!r.grantsExecute || !!r.grantsShieldConvert || !!r.grantsDarkMagic
}

// The parity gate below only cares about Duos that draw an EXTRA rng mid-battle — MIASMA
// (maybeSpreadPoison) and UNTORE (maybeSpitPoison) — since those are the only ones whose
// extra draw could desync a replay. The other 4 Duos (CANCRENA/MURO VIVENTE/ESECUZIONE A
// FREDDO/MIETITORE) are rng-free stat stamps and prove nothing about replay-rng parity.
const RNG_DRAWING_DUO_IDS = new Set(['miasma', 'untore'])

/** Duo-biased draft: at each of the STARTER_PICKS DraftSession screens, pick whichever
 *  candidate in `session.current` most lights a Duo tag-signal (preferDuoScore); if no
 *  candidate scores above 0 (no tag/role hit), fall back to index 0 — mirrors the old
 *  house-offer bias, just applied to the DraftSession's own screen instead. */
function draftByDuoBias(seed: string): { draftPicks: string[]; picks: DraftedWizard[] } {
  setDraftPoolRestriction(null)
  let session: DraftSession = startDraft(seed, STARTER_PICKS)
  const draftPicks: string[] = []
  for (let i = 0; i < STARTER_PICKS; i++) {
    let idx = 0
    let bestScore = -Infinity
    session.current.forEach((c, j) => {
      const score = preferDuoScore(c)
      if (score > bestScore) { bestScore = score; idx = j }
    })
    draftPicks.push(session.current[idx]!.wizard.id)
    session = pickFrom(session, idx)
  }
  return { draftPicks, picks: session.picks }
}

/** Duo-biased variant of playAndRecord: identical structure/rng-per-action-kind, but recruit
 *  and relic picks prefer whatever most quickly lights a Duo tag-signal. Also tracks (via
 *  `detectDuos`, the SAME function resolvers/combat.ts calls at battle-resolve time) whether
 *  any battle-ack action in the recorded log fired while the living team + relics had an
 *  ACTIVE rng-drawing Duo (MIASMA/UNTORE) — the proof this run's log genuinely exercises the
 *  extra Duo combat rng draw that caused the original combat-replay defect. */
function playAndRecordDuoBiased(seed: string): { playedScore: number; log: RunLog; sawRngDuoBattle: boolean } {
  // Starters biased too (not just recruit/relic): pickNode below fights nearly every floor
  // and only rarely routes to a recruit/relic node, so the STARTER trio is what actually
  // shapes team composition for most of a run — a raw-power starter pick (like the plain
  // SEEDS harness above) would almost never accumulate 2 tag-sharing wizards at all.
  const { draftPicks, picks } = draftByDuoBias(seed)
  const actions: PlayerAction[] = []
  let sawRngDuoBattle = false

  // endless:true must be set BEFORE confirmDraftPicks so area-0 excludes altare —
  // mirrors replayRun's own reconstruction (game/engine/endlessReplay.ts).
  let s: RunState = confirmDraftPicks({ ...startRunB(seed), endless: true }, picks, createRng(seed))

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
      // Mirrors resolvers/combat.ts's own detectDuos(livingOf(state.team), state.relics) call —
      // the exact check that decides whether this battle runs with leftDuos active. Only
      // MIASMA/UNTORE count here — see RNG_DRAWING_DUO_IDS above.
      const activeDuos = detectDuos(livingOf(s.team), s.relics)
      if (activeDuos.some(d => RNG_DRAWING_DUO_IDS.has(d.duo.id))) sawRngDuoBattle = true
      actions.push({ t: 'resolve', choice: { kind: 'combat-ack' } })
      s = resolveCurrent(s, { kind: 'combat-ack' }, combatRngForNode(seed, node.id))
      continue
    }
    if (s.phase === 'recruit-node') {
      const off = recruitOffer(s, node, createRng(seed))
      const best = [...off].sort((a, b) => preferDuoScore(b) - preferDuoScore(a))[0]
      if (!best) {
        actions.push({ t: 'resolve', choice: { kind: 'skip' } })
        s = resolveCurrent(s, { kind: 'skip' }, createRng(seed))
      } else {
        const full = s.team.length >= (s.teamMax ?? 5)
        const replaceId = full ? [...s.team].sort((a, b) => preferDuoScore(a) - preferDuoScore(b))[0]!.wizard.id : undefined
        actions.push({ t: 'resolve', choice: { kind: 'recruit-pick', wizardId: best.wizard.id, replaceId } })
        s = resolveCurrent(s, { kind: 'recruit-pick', wizardId: best.wizard.id, replaceId }, createRng(seed))
      }
      s = { ...s, phase: 'map' }; continue
    }
    if (s.phase === 'relic-node') {
      const off = relicOffer(s, node, createRng(seed))
      const preferred = off.find(relicLightsADuoSignal)
      const relicId = preferred?.id ?? off[0]?.id ?? '__none__'
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

  const log: RunLog = { v: 1, engine: ENGINE_VERSION, seed, draftPicks, actions }
  return { playedScore: scoreForEndlessRun(s), log, sawRngDuoBattle }
}

const DUO_SEEDS = Array.from({ length: 30 }, (_, i) => `duo-parity-${i}`)

describe('endless replay parity — Duo-active runs (MIASMA/UNTORE draw extra rng mid-battle)', () => {
  it('replayed score equals played score for every Duo-biased seed', () => {
    const mismatches: { seed: string; played: number; replayed: number | null; valid: boolean; reason?: string }[] = []
    let anyRngDuoBattle = false
    for (const seed of DUO_SEEDS) {
      const { playedScore, log, sawRngDuoBattle } = playAndRecordDuoBiased(seed)
      if (sawRngDuoBattle) anyRngDuoBattle = true
      const out = replayRun(log)
      const replayedScore = out.valid ? scoreForEndlessRun(out.state) : null
      if (!out.valid || replayedScore !== playedScore) {
        mismatches.push({ seed, played: playedScore, replayed: replayedScore, valid: out.valid, reason: out.reason })
      }
    }
    if (mismatches.length > 0) {
      // eslint-disable-next-line no-console
      console.log('[endlessReplayParity duo] mismatches:', JSON.stringify(mismatches, null, 2))
    }
    // eslint-disable-next-line no-console
    console.log(`[endlessReplayParity duo] seeds=${DUO_SEEDS.length} anyRngDuoBattle=${anyRngDuoBattle} mismatches=${mismatches.length}`)
    // Sanity check the bias is real: if NO seed ever fielded an active rng-drawing Duo
    // (MIASMA/UNTORE), this suite would be silently testing nothing new for the replay-rng
    // defect it exists to guard — fail loudly instead of passing on a technicality.
    expect(anyRngDuoBattle).toBe(true)
    expect(mismatches).toEqual([])
  })

  it('is deterministic (same Duo-biased seed replayed twice yields the same score)', () => {
    for (const seed of DUO_SEEDS.slice(0, 5)) {
      const { log } = playAndRecordDuoBiased(seed)
      const a = replayRun(log)
      const b = replayRun(log)
      expect(a.valid).toBe(true)
      expect(b.valid).toBe(true)
      expect(scoreForEndlessRun(a.state)).toBe(scoreForEndlessRun(b.state))
    }
  })
})
