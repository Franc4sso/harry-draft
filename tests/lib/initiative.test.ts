import { describe, it, expect } from 'vitest'
import { initiativeOrder, initiativeAt, lastRealActorAt, lastRealEntryAt } from '@/lib/initiative'
import { buildReplay, unitKey } from '@/game/engine/combat/replay'
import { simulateBattle } from '@/game/engine/combat/simulate'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARD_BY_ID } from '@/data/wizards'
import type { DraftedWizard } from '@/types'

function team(ids: string[], seed = 1): DraftedWizard[] {
  const r = createRng(seed)
  return ids.map(id => draftWizard(r, WIZARD_BY_ID[id]!))
}
const mk = () => {
  const l = team(['harry', 'ron', 'hermione', 'luna', 'neville'], 7)
  const r = team(['draco', 'crabbe', 'goyle', 'snape', 'bellatrix'], 13)
  return buildReplay(simulateBattle(l, r, createRng(42)), l, r)
}

describe('initiativeOrder', () => {
  it('lists one slot per non-system action, in log order', () => {
    const replay = mk()
    const order = initiativeOrder(replay)
    expect(order.length).toBeGreaterThan(0)
    // Every slot key belongs to a real unit.
    const keys = new Set(replay.units.map(u => u.key))
    for (const s of order) expect(keys.has(s.key)).toBe(true)
  })
  it('is a pure projection of the actor sequence (no system frames)', () => {
    const replay = mk()
    const acted = replay.frames
      .filter(f => f.entry && f.entry.type !== 'system' && f.entry.actorSide)
      .map(f => unitKey(f.entry!.actorSide!, f.entry!.actorId))
    expect(initiativeOrder(replay).map(s => s.key)).toEqual(acted)
  })
})

describe('initiativeAt', () => {
  it('returns the acting unit at a given action index', () => {
    const replay = mk()
    // First real action frame index.
    const firstReal = replay.frames.findIndex(f => f.entry && f.entry.type !== 'system' && f.entry.actorSide)
    const { current } = initiativeAt(replay, firstReal)
    const f = replay.frames[firstReal]!
    expect(current).toBe(unitKey(f.entry!.actorSide!, f.entry!.actorId))
  })
  it('returns null current and empty upcoming at the initial frame', () => {
    const replay = mk()
    expect(initiativeAt(replay, 0)).toEqual({ current: null, upcoming: [] })
  })
  it('caps upcoming at five distinct actors', () => {
    const replay = mk()
    const { upcoming } = initiativeAt(replay, 1)
    expect(upcoming.length).toBeLessThanOrEqual(5)
    expect(new Set(upcoming).size).toBe(upcoming.length)
  })
})

describe('lastRealActorAt', () => {
  it('returns null before any real action (initial frame)', () => {
    const replay = mk()
    expect(lastRealActorAt(replay, 0)).toBeNull()
  })
  it('returns the actor of a real action frame', () => {
    const replay = mk()
    const firstReal = replay.frames.findIndex(f => f.entry && f.entry.type !== 'system' && f.entry.actorSide)
    const f = replay.frames[firstReal]!
    expect(lastRealActorAt(replay, firstReal)).toBe(unitKey(f.entry!.actorSide!, f.entry!.actorId))
  })
  it('persists the last real actor across a following system frame', () => {
    const replay = mk()
    const firstReal = replay.frames.findIndex(f => f.entry && f.entry.type !== 'system' && f.entry.actorSide)
    // Find a system frame strictly after a real action.
    const sysIdx = replay.frames.findIndex(
      (f, i) => i > firstReal && f.entry && (f.entry.type === 'system' || !f.entry.actorSide),
    )
    expect(sysIdx).toBeGreaterThan(firstReal)
    // The persisted actor is the most recent real actor at or before sysIdx.
    let expected: string | null = null
    for (let i = sysIdx; i >= 0; i--) {
      const e = replay.frames[i]!.entry
      if (e && e.type !== 'system' && e.actorSide) { expected = unitKey(e.actorSide, e.actorId); break }
    }
    expect(lastRealActorAt(replay, sysIdx)).toBe(expected)
  })
})

describe('lastRealEntryAt', () => {
  it('returns null before any real action (initial frame)', () => {
    const replay = mk()
    expect(lastRealEntryAt(replay, 0)).toBeNull()
  })
  it('returns the entry of a real action frame', () => {
    const replay = mk()
    const firstReal = replay.frames.findIndex(f => f.entry && f.entry.type !== 'system' && f.entry.actorSide)
    expect(lastRealEntryAt(replay, firstReal)).toBe(replay.frames[firstReal]!.entry)
  })
  it('holds the prior real entry across a following system frame', () => {
    const replay = mk()
    const firstReal = replay.frames.findIndex(f => f.entry && f.entry.type !== 'system' && f.entry.actorSide)
    const sysIdx = replay.frames.findIndex(
      (f, i) => i > firstReal && f.entry && (f.entry.type === 'system' || !f.entry.actorSide),
    )
    expect(sysIdx).toBeGreaterThan(firstReal)
    let expected = null as typeof replay.frames[number]['entry']
    for (let i = sysIdx; i >= 0; i--) {
      const e = replay.frames[i]!.entry
      if (e && e.type !== 'system' && e.actorSide) { expected = e; break }
    }
    expect(lastRealEntryAt(replay, sysIdx)).toBe(expected)
  })
})
