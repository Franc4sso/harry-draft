import { describe, it, expect } from 'vitest'
import { simulateBattle } from '@/game/engine/combat/simulate'
import { buildReplay, unitKey } from '@/game/engine/combat/replay'
import { createRng } from '@/game/engine/rng'
import { SPELL_BY_ID } from '@/data/spells'
import type { DraftedWizard, Spell } from '@/types'

// Deterministic drafted wizard with an explicit spell, so cooldown/dot behavior is fixed.
function dw(id: string, spell: Spell, over: Partial<DraftedWizard> = {}): DraftedWizard {
  // Tanky + low atk so battles run many turns: cooldowns and dots get to tick down,
  // making decrement observable across snapshots.
  const stats = { hp: 2000, atk: 30, def: 60, spd: 40 }
  return {
    wizard: {
      id, name: id, house: 'Grifondoro', role: 'Attaccante', tier: 3,
      ranges: { hp: [2000, 2000], atk: [30, 30], def: [60, 60], spd: [40, 40] },
      spellPool: [spell.id],
    },
    stats, maxHp: stats.hp, spell, ...over,
  }
}

// incendio: cooldown 1, applies a dot (amount 8, duration 2).
const INCENDIO = SPELL_BY_ID['incendio']!
// sectumsempra: cooldown 2, pure damage (no status).
const SECTUM = SPELL_BY_ID['sectumsempra']!

describe('simulateBattle captures per-step snapshots', () => {
  it('snapshots is 1:1 with log', () => {
    const left = [dw('lefty', SECTUM)]
    const right = [dw('righty', SECTUM)]
    const res = simulateBattle(left, right, createRng(3))
    expect(res.snapshots).toBeDefined()
    expect(res.snapshots.length).toBe(res.log.length)
    expect(res.snapshots.length).toBeGreaterThan(0)
  })

  it('every snapshot keys every unit by side:id with deep-copied containers', () => {
    const left = [dw('lefty', SECTUM)]
    const right = [dw('righty', SECTUM)]
    const res = simulateBattle(left, right, createRng(3))
    const kL = unitKey('left', 'lefty')
    const kR = unitKey('right', 'righty')
    for (const snap of res.snapshots) {
      expect(snap[kL]).toBeDefined()
      expect(snap[kR]).toBeDefined()
      // containers exist and are objects/arrays (not undefined)
      expect(typeof snap[kL]!.cooldowns).toBe('object')
      expect(Array.isArray(snap[kL]!.statusEffects)).toBe(true)
    }
  })

  it('a cooldown set early is NOT mutated in later snapshots (deep copy + real decrement)', () => {
    // sectumsempra cooldown 2: after the caster acts, that frame shows 2; later it ticks down.
    const left = [dw('lefty', SECTUM)]
    const right = [dw('righty', SECTUM)]
    const res = simulateBattle(left, right, createRng(3))
    const k = unitKey('left', 'lefty')

    // first snapshot where lefty has the spell on cooldown
    const firstCdIdx = res.snapshots.findIndex(s => (s[k]!.cooldowns[SECTUM.id] ?? 0) > 0)
    expect(firstCdIdx).toBeGreaterThanOrEqual(0)
    const firstCd = res.snapshots[firstCdIdx]![k]!.cooldowns[SECTUM.id]!
    expect(firstCd).toBe(SECTUM.cooldown)

    // a later snapshot must show a strictly smaller cooldown (proves real decrement happened
    // AND the early snapshot was deep-copied — else it would read the decremented value too).
    const laterLower = res.snapshots
      .slice(firstCdIdx + 1)
      .some(s => (s[k]!.cooldowns[SECTUM.id] ?? 0) < firstCd)
    expect(laterLower).toBe(true)
    // the early snapshot still shows the full cooldown — untouched by later ticks.
    expect(res.snapshots[firstCdIdx]![k]!.cooldowns[SECTUM.id]).toBe(firstCd)
  })

  it('a dot status appears on the target and its remaining decreases over frames', () => {
    const left = [dw('lefty', INCENDIO)]
    const right = [dw('righty', SECTUM)]
    const res = simulateBattle(left, right, createRng(5))
    const target = unitKey('right', 'righty')

    const dotFrames = res.snapshots
      .map((s, i) => ({ i, dot: s[target]!.statusEffects.find(e => e.kind === 'dot') }))
      .filter(x => x.dot)

    expect(dotFrames.length).toBeGreaterThan(0)
    const first = dotFrames[0]!
    expect(first.dot!.remaining).toBeGreaterThan(0)

    // remaining must decrease across the dot's lifetime in some later frame.
    const minRemaining = Math.min(...dotFrames.map(x => x.dot!.remaining))
    expect(minRemaining).toBeLessThan(first.dot!.remaining)
  })
})

describe('buildReplay populates cooldowns + statusEffects from snapshots', () => {
  it('frame 0 has empty cooldowns/statusEffects maps', () => {
    const left = [dw('lefty', INCENDIO)]
    const right = [dw('righty', SECTUM)]
    const res = simulateBattle(left, right, createRng(5))
    const replay = buildReplay(res, left, right)
    const f0 = replay.frames[0]!
    expect(f0.cooldowns).toEqual({})
    expect(f0.statusEffects).toEqual({})
  })

  it('frame k cooldowns/statusEffects come from snapshots[k-1]', () => {
    const left = [dw('lefty', INCENDIO)]
    const right = [dw('righty', SECTUM)]
    const res = simulateBattle(left, right, createRng(5))
    const replay = buildReplay(res, left, right)
    const kL = unitKey('left', 'lefty')
    const target = unitKey('right', 'righty')

    // pick a snapshot index that has the lefty cooldown set; frame index is that +1.
    const snapIdx = res.snapshots.findIndex(s => (s[kL]!.cooldowns[INCENDIO.id] ?? 0) > 0)
    expect(snapIdx).toBeGreaterThanOrEqual(0)
    const frame = replay.frames[snapIdx + 1]!
    expect(frame.cooldowns[kL]![INCENDIO.id]).toBe(res.snapshots[snapIdx]![kL]!.cooldowns[INCENDIO.id])

    // a dot frame: statusEffects propagated for the target
    const dotSnapIdx = res.snapshots.findIndex(s => s[target]!.statusEffects.some(e => e.kind === 'dot'))
    expect(dotSnapIdx).toBeGreaterThanOrEqual(0)
    const dotFrame = replay.frames[dotSnapIdx + 1]!
    expect(dotFrame.statusEffects[target]!.some(e => e.kind === 'dot')).toBe(true)
  })

  it('guards gracefully when result has no snapshots (hand-built BattleResult)', () => {
    const left = [dw('lefty', INCENDIO)]
    const right = [dw('righty', SECTUM)]
    const fake = { winner: 'left' as const, turns: 0, log: [], mvpId: 'lefty', finalSnapshot: [] }
    // @ts-expect-error intentionally missing `snapshots` to exercise the guard
    const replay = buildReplay(fake, left, right)
    expect(replay.frames[0]!.cooldowns).toEqual({})
    expect(replay.frames[0]!.statusEffects).toEqual({})
  })
})
