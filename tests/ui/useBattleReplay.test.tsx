import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useBattleReplay, regenBatchEnd, frameDelay } from '@/hooks/useBattleReplay'
import { buildReplay } from '@/game/engine/combat/replay'
import type { Replay, ReplayUnit, ReplayFrame } from '@/game/engine/combat/replay'
import type { LogEntry } from '@/types'
import { simulateBattle } from '@/game/engine/combat/simulate'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARD_BY_ID } from '@/data/wizards'
import type { DraftedWizard } from '@/types'

function team(ids: string[], seed = 1): DraftedWizard[] {
  const r = createRng(seed)
  return ids.map(id => draftWizard(r, WIZARD_BY_ID[id]!))
}

describe('regenBatchEnd', () => {
  const regen = (turn: number, id: string): LogEntry =>
    ({ turn, actorId: id, actorSide: 'left', action: 'Rigenerazione', targetId: id, targetSide: 'left', type: 'Cura', value: 12, flags: ['heal'] } as LogEntry)
  const hit = (turn: number): LogEntry =>
    ({ turn, actorId: 'x', actorSide: 'left', action: 'Colpo', targetId: 'y', targetSide: 'right', type: 'Attacco', value: 20, flags: [] } as LogEntry)
  const f = (entry: LogEntry | null): ReplayFrame => ({ index: 0, entry, hp: {}, cooldowns: {}, statusEffects: {} })
  // [0]null [1]hit t2 [2]regen-a t3 [3]regen-b t3 [4]regen-c t3 [5]hit t4
  const frames: ReplayFrame[] = [f(null), f(hit(2)), f(regen(3, 'a')), f(regen(3, 'b')), f(regen(3, 'c')), f(hit(4))]

  it('jumps to the last consecutive same-turn regen tick (heal all at once)', () => {
    expect(regenBatchEnd(frames, 2)).toBe(4) // land on first regen → skip to last
  })
  it('leaves non-regen frames untouched', () => {
    expect(regenBatchEnd(frames, 1)).toBe(1)
    expect(regenBatchEnd(frames, 5)).toBe(5)
  })
  it('does not merge regen across different turns', () => {
    const two = [f(regen(3, 'a')), f(regen(4, 'b'))]
    expect(regenBatchEnd(two, 0)).toBe(0)
  })
})

/**
 * Il ritmo dei Duo. La sosta lunga è un premio per il momento RARO: il PRIMO scatto di un Duo,
 * l'unico che si prende l'annuncio centrale col nome. Dal secondo in poi il frame torna al suo
 * ramo naturale — altrimenti una build veleno, dove CANCRENA marchia 10-15 tick per battaglia,
 * allungherebbe il replay di una ventina di secondi (ogni tick da 600ms a 2040ms).
 */
describe('frameDelay — il ritmo dei Duo', () => {
  const dotDuo: LogEntry = {
    turn: 1, actorId: 'vel', actorSide: 'left', action: 'Veleno', targetId: 'foe', targetSide: 'right',
    type: 'Controllo', value: 12, flags: ['dot', 'duo'], duoId: 'cancrena',
  } as LogEntry
  const plainDot: LogEntry = { ...dotDuo, flags: ['dot'], duoId: undefined } as LogEntry

  it('il PRIMO scatto si prende la sosta lunga (come un kill)', () => {
    expect(frameDelay(dotDuo, 1000, true)).toBe(1700)
  })

  it('gli scatti SUCCESSIVI dello stesso Duo tornano al loro ramo naturale (dot = breve)', () => {
    expect(frameDelay(dotDuo, 1000, false)).toBe(500)
    // ...cioè esattamente quanto durerebbe lo stesso tick senza alcun Duo: il marchio non pesa.
    expect(frameDelay(dotDuo, 1000, false)).toBe(frameDelay(plainDot, 1000))
  })

  it('un frame di SISTEMA marchiato da un Duo (Untore/Miasma) resta breve se non è il primo', () => {
    const sys = { ...dotDuo, type: 'system', flags: ['duo'], duoId: 'untore', value: undefined } as unknown as LogEntry
    expect(frameDelay(sys, 1000, true)).toBe(1700)
    expect(frameDelay(sys, 1000, false)).toBe(500)
  })
})

/** Due tick di CANCRENA di fila: solo il primo è "il primo scatto". Frame 3 tiene in vita il
 *  nemico fino alla fine, così deathFrame non interferisce con l'avanzamento. */
function makeDuoPacingReplay(): Replay {
  const left = makeUnit('left:vel', 'left')
  const right = makeUnit('right:foe', 'right')
  const tick = (turn: number): LogEntry => ({
    turn, actorId: 'vel', actorSide: 'left', action: 'Veleno', targetId: 'foe', targetSide: 'right',
    type: 'Controllo', value: 10, flags: ['dot', 'duo'], duoId: 'cancrena',
  } as LogEntry)
  return {
    units: [left, right], winner: 'left', mvpId: 'vel', turns: 3,
    frames: [
      { index: 0, entry: null, hp: { 'left:vel': 100, 'right:foe': 100 }, cooldowns: {}, statusEffects: {} },
      { index: 1, entry: tick(1), hp: { 'left:vel': 100, 'right:foe': 90 }, cooldowns: {}, statusEffects: {} },
      { index: 2, entry: tick(2), hp: { 'left:vel': 100, 'right:foe': 80 }, cooldowns: {}, statusEffects: {} },
      { index: 3, entry: tick(3), hp: { 'left:vel': 100, 'right:foe': 70 }, cooldowns: {}, statusEffects: {} },
    ],
  }
}

/** Il colpo di grazia è ANCHE il primo scatto di ESECUZIONE A FREDDO: il modale non deve
 *  aprirsi sull'annuncio ancora a schermo. */
function makeDuoDeathReplay(): Replay {
  const left = makeUnit('left:att', 'left')
  const right = makeUnit('right:foe', 'right')
  return {
    units: [left, right], winner: 'left', mvpId: 'att', turns: 1,
    frames: [
      { index: 0, entry: null, hp: { 'left:att': 100, 'right:foe': 100 }, cooldowns: {}, statusEffects: {} },
      { index: 1, entry: { turn: 1, actorId: 'att', actorSide: 'left', action: 'Colpo', targetId: 'foe', targetSide: 'right', type: 'Attacco', value: 40, flags: [] }, hp: { 'left:att': 100, 'right:foe': 60 }, cooldowns: {}, statusEffects: {} },
      { index: 2, entry: { turn: 1, actorId: 'att', actorSide: 'left', action: 'Colpo', targetId: 'foe', targetSide: 'right', type: 'Attacco', value: 60, flags: ['crit', 'kill', 'duo'], duoId: 'esecuzione-a-freddo' } as LogEntry, hp: { 'left:att': 100, 'right:foe': 0 }, cooldowns: {}, statusEffects: {} },
    ],
  }
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

  it('allunga SOLO il primo scatto di un Duo; il secondo tick scorre alla velocità del suo ramo', () => {
    const replay = makeDuoPacingReplay()
    const { result } = renderHook(() => useBattleReplay(replay, { autoPlay: true, stepMs: 1000 }))
    // Frame 0 (nessuna entry) → base.
    act(() => { vi.advanceTimersByTime(1000) })
    expect(result.current.index).toBe(1)
    // Frame 1 = PRIMO scatto di cancrena → sosta lunga (1.7x): a 1699ms non si è ancora mosso.
    act(() => { vi.advanceTimersByTime(1699) })
    expect(result.current.index).toBe(1)
    act(() => { vi.advanceTimersByTime(1) })
    expect(result.current.index).toBe(2)
    // Frame 2 = SECONDO scatto dello stesso Duo → ramo dot (0.5x): 500ms bastano.
    act(() => { vi.advanceTimersByTime(500) })
    expect(result.current.index).toBe(3)
  })

  it('quando il colpo di grazia porta un Duo, il modale aspetta che l annuncio sia leggibile', () => {
    const replay = makeDuoDeathReplay()
    const { result } = renderHook(() => useBattleReplay(replay, { autoPlay: false }))
    act(() => { result.current.step(); result.current.step() })
    expect(result.current.index).toBe(2)
    expect(result.current.deathFrame).toBe(2)
    // A 600ms (il ritardo normale) il modale coprirebbe ancora l'annuncio (che vive 1300ms).
    act(() => { vi.advanceTimersByTime(600) })
    expect(result.current.modalReady).toBe(false)
    act(() => { vi.advanceTimersByTime(900) })
    expect(result.current.modalReady).toBe(true)
  })

  it('senza Duo sul frame di morte il ritardo del modale resta quello normale (600ms)', () => {
    const replay = makeReplayWithTrailingWinnerFrames()
    const { result } = renderHook(() => useBattleReplay(replay, { autoPlay: false }))
    act(() => { result.current.step(); result.current.step() })
    expect(result.current.index).toBe(2)
    act(() => { vi.advanceTimersByTime(600) })
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
