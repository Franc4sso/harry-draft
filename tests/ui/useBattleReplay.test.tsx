import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useBattleReplay } from '@/hooks/useBattleReplay'
import { buildReplay } from '@/game/engine/combat/replay'
import type { Replay, ReplayUnit } from '@/game/engine/combat/replay'
import { simulateBattle } from '@/game/engine/combat/simulate'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARD_BY_ID } from '@/data/wizards'
import type { DraftedWizard } from '@/types'

function team(ids: string[], seed = 1): DraftedWizard[] {
  const r = createRng(seed)
  return ids.map(id => draftWizard(r, WIZARD_BY_ID[id]!))
}

function makeReplay() {
  const l = team(['harry', 'ron', 'hermione', 'luna', 'neville'], 7)
  const r = team(['draco', 'crabbe', 'goyle', 'snape', 'bellatrix'], 13)
  return buildReplay(simulateBattle(l, r, createRng(42)), l, r)
}

/** Minimal hand-built replay unit fixture (only the fields useBattleReplay cares about). */
function makeUnit(key: string, side: 'left' | 'right', maxHp = 100): ReplayUnit {
  return {
    key, side, id: key, name: key, house: 'Grifondoro', role: 'Attaccante', tier: 1,
    maxHp, atk: 10, def: 10, spd: 10, baseAtk: 10, baseDef: 10, baseSpd: 10,
    spell: { id: 'spell', name: 'Spell', cooldown: 0 },
  }
}

/**
 * A hand-built replay simulating the real bug: the enemy (right side) dies at frame 2,
 * but the log keeps going — trailing WINNER-side (left) frames for regen/fatigue after
 * the killing blow, exactly like simulate.ts's end-of-turn block does for the winner.
 * deathFrame should land on frame 2, NOT on the final frame (5).
 */
function makeReplayWithTrailingWinnerFrames(): Replay {
  const left = makeUnit('left:harry', 'left')
  const right = makeUnit('right:draco', 'right')
  return {
    units: [left, right],
    winner: 'left',
    mvpId: 'harry',
    turns: 3,
    frames: [
      { index: 0, entry: null, hp: { 'left:harry': 100, 'right:draco': 100 }, cooldowns: {}, statusEffects: {} },
      { index: 1, entry: { turn: 1, actorId: 'harry', actorSide: 'left', action: 'Incantesimo', targetId: 'draco', targetSide: 'right', type: 'Attacco', value: 40, flags: [] }, hp: { 'left:harry': 100, 'right:draco': 60 }, cooldowns: {}, statusEffects: {} },
      // Enemy dies HERE (frame 2) — this is the true death frame.
      { index: 2, entry: { turn: 1, actorId: 'harry', actorSide: 'left', action: 'Incantesimo', targetId: 'draco', targetSide: 'right', type: 'Attacco', value: 60, flags: [] }, hp: { 'left:harry': 100, 'right:draco': 0 }, cooldowns: {}, statusEffects: {} },
      // KO system frame — still frame where right is at 0.
      { index: 3, entry: { turn: 1, actorId: 'harry', actorSide: 'left', action: 'KO', targetId: 'draco', targetSide: 'right', type: 'system', flags: ['kill'] }, hp: { 'left:harry': 100, 'right:draco': 0 }, cooldowns: {}, statusEffects: {} },
      // Trailing WINNER-side (left) frames after the kill: regen + fatigue, as simulate.ts appends.
      { index: 4, entry: { turn: 2, actorId: 'harry', actorSide: 'left', action: 'Rigenera', targetId: 'harry', targetSide: 'left', type: 'Cura', value: 5, flags: ['heal'] }, hp: { 'left:harry': 100, 'right:draco': 0 }, cooldowns: {}, statusEffects: {} },
      { index: 5, entry: { turn: 3, actorId: 'harry', actorSide: 'left', action: 'Fatica', targetId: 'harry', targetSide: 'left', type: 'system', value: 3, flags: ['dot'] }, hp: { 'left:harry': 97, 'right:draco': 0 }, cooldowns: {}, statusEffects: {} },
    ],
  }
}

/** A timeout-win replay: both sides survive to the last frame (no unit-death frame exists). */
function makeTimeoutReplay(): Replay {
  const left = makeUnit('left:harry', 'left')
  const right = makeUnit('right:draco', 'right')
  return {
    units: [left, right],
    winner: 'left',
    mvpId: 'harry',
    turns: 2,
    frames: [
      { index: 0, entry: null, hp: { 'left:harry': 100, 'right:draco': 100 }, cooldowns: {}, statusEffects: {} },
      { index: 1, entry: { turn: 1, actorId: 'harry', actorSide: 'left', action: 'Incantesimo', targetId: 'draco', targetSide: 'right', type: 'Attacco', value: 20, flags: [] }, hp: { 'left:harry': 100, 'right:draco': 80 }, cooldowns: {}, statusEffects: {} },
      { index: 2, entry: { turn: 2, actorId: 'draco', actorSide: 'right', action: 'Incantesimo', targetId: 'harry', targetSide: 'left', type: 'Attacco', value: 10, flags: [] }, hp: { 'left:harry': 90, 'right:draco': 80 }, cooldowns: {}, statusEffects: {} },
    ],
  }
}

describe('useBattleReplay', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('starts paused at the initial frame when autoPlay is off', () => {
    const replay = makeReplay()
    const { result } = renderHook(() => useBattleReplay(replay, { autoPlay: false }))
    expect(result.current.index).toBe(0)
    expect(result.current.playing).toBe(false)
    expect(result.current.entry).toBeNull()
  })

  it('advances one frame per step when playing', () => {
    const replay = makeReplay()
    const { result } = renderHook(() => useBattleReplay(replay, { autoPlay: true, stepMs: 100 }))
    expect(result.current.index).toBe(0)
    act(() => { vi.advanceTimersByTime(100) })
    expect(result.current.index).toBe(1)
    act(() => { vi.advanceTimersByTime(100) })
    expect(result.current.index).toBe(2)
  })

  it('skip jumps to the last frame and stops', () => {
    const replay = makeReplay()
    const { result } = renderHook(() => useBattleReplay(replay, { autoPlay: false }))
    act(() => { result.current.skip() })
    expect(result.current.index).toBe(result.current.total - 1)
    expect(result.current.done).toBe(true)
    expect(result.current.playing).toBe(false)
  })

  it('modalReady is false immediately when done becomes true (before delay)', () => {
    const replay = makeReplay()
    const { result } = renderHook(() => useBattleReplay(replay, { autoPlay: false }))
    // Drive to the last frame using step() calls (no timers involved) so we can
    // isolate the post-death delay check independently.
    act(() => {
      const total = result.current.total
      for (let i = 0; i < total - 1; i++) result.current.step()
    })
    expect(result.current.done).toBe(true)
    // Modal NOT ready yet — the delay hasn't started being consumed
    expect(result.current.modalReady).toBe(false)
  })

  it('modalReady becomes true after POST_DEATH_DELAY_MS', () => {
    const replay = makeReplay()
    const { result } = renderHook(() => useBattleReplay(replay, { autoPlay: false }))
    act(() => {
      const total = result.current.total
      for (let i = 0; i < total - 1; i++) result.current.step()
    })
    expect(result.current.done).toBe(true)
    expect(result.current.modalReady).toBe(false)
    // Advance past the post-death delay
    act(() => { vi.advanceTimersByTime(1000) })
    expect(result.current.modalReady).toBe(true)
  })

  it('computes deathFrame as the first frame where the losing side is fully dead, not the last frame', () => {
    const replay = makeReplayWithTrailingWinnerFrames()
    const { result } = renderHook(() => useBattleReplay(replay, { autoPlay: false }))
    expect(result.current.total).toBe(6) // frames 0..5
    expect(result.current.deathFrame).toBe(2)
    expect(result.current.deathFrame).toBeLessThan(result.current.total - 1)
  })

  it('modalReady triggers POST_DEATH_DELAY_MS after reaching deathFrame, while trailing frames keep playing underneath', () => {
    const replay = makeReplayWithTrailingWinnerFrames()
    const { result } = renderHook(() => useBattleReplay(replay, { autoPlay: false }))
    act(() => {
      result.current.step() // -> index 1
      result.current.step() // -> index 2 == deathFrame
    })
    expect(result.current.index).toBe(2)
    expect(result.current.modalReady).toBe(false)
    // Not done yet — replay keeps playing trailing frames underneath the (not-yet-shown) modal.
    expect(result.current.done).toBe(false)
    act(() => { vi.advanceTimersByTime(1000) })
    expect(result.current.modalReady).toBe(true)
    // Advancing further (trailing frames) must not un-ready the modal or restart the delay.
    act(() => { result.current.step() })
    expect(result.current.index).toBe(3)
    expect(result.current.modalReady).toBe(true)
  })

  it('falls back to the last frame for a timeout win with survivors on both sides', () => {
    const replay = makeTimeoutReplay()
    const { result } = renderHook(() => useBattleReplay(replay, { autoPlay: false }))
    expect(result.current.deathFrame).toBe(result.current.total - 1)
  })

  it('skip sets modalReady immediately without waiting for the delay', () => {
    const replay = makeReplay()
    const { result } = renderHook(() => useBattleReplay(replay, { autoPlay: false }))
    expect(result.current.modalReady).toBe(false)
    act(() => { result.current.skip() })
    expect(result.current.done).toBe(true)
    expect(result.current.modalReady).toBe(true)
    // Timer should NOT be needed — verify it stays true even without advancing time
    expect(result.current.modalReady).toBe(true)
  })

  it('honours speed multiplier', () => {
    const replay = makeReplay()
    const { result } = renderHook(() => useBattleReplay(replay, { autoPlay: true, stepMs: 100 }))
    act(() => { result.current.setSpeed(2) })
    act(() => { vi.advanceTimersByTime(50) })
    expect(result.current.index).toBe(1)
  })

  it('stops playing once it reaches the end', () => {
    const replay = makeReplay()
    const { result } = renderHook(() => useBattleReplay(replay, { autoPlay: false }))
    act(() => { result.current.skip() })
    act(() => { result.current.play() })
    act(() => { vi.advanceTimersByTime(10000) })
    expect(result.current.done).toBe(true)
  })

  it('step advances exactly one action and pauses', () => {
    const replay = makeReplay()
    const { result } = renderHook(() => useBattleReplay(replay, { autoPlay: false }))
    expect(result.current.index).toBe(0)
    act(() => result.current.step())
    expect(result.current.index).toBe(1)
    expect(result.current.playing).toBe(false)
  })

  it('stepBack rewinds one action without going below zero', () => {
    const replay = makeReplay()
    const { result } = renderHook(() => useBattleReplay(replay, { autoPlay: false }))
    act(() => { result.current.step(); result.current.step() })
    expect(result.current.index).toBe(2)
    act(() => result.current.stepBack())
    expect(result.current.index).toBe(1)
    act(() => { result.current.stepBack(); result.current.stepBack() })
    expect(result.current.index).toBe(0)
  })

  it('exposes currentTurn: 0 before any action, then the played entry\'s turn', () => {
    const replay = makeReplay()
    const { result } = renderHook(() => useBattleReplay(replay, { autoPlay: false }))
    expect(result.current.currentTurn).toBe(0)
    act(() => result.current.step())
    expect(result.current.currentTurn).toBe(result.current.entry?.turn)
  })
})
