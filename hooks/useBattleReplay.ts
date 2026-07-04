'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import type { LogEntry } from '@/types'
import type { Replay, ReplayFrame } from '@/game/engine/combat/replay'

export const REPLAY_SPEEDS = [1, 2, 4] as const
export type ReplaySpeed = (typeof REPLAY_SPEEDS)[number]

// Must exceed the HpBar spring settle time (~stiffness 220/damping 30, settles well under
// 500ms) so the victory modal never appears while an HP bar is still visibly draining.
const POST_DEATH_DELAY_MS = 600

/** Per-frame dwell time: linger on the big moments (kill/crit) and fast-forward the
 *  trivial ticks (DoT/regen/fatigue/system/wait) so the reveal has dramatic rhythm
 *  instead of a flat metronome. Multiplies the base step; `speed` still divides it. */
export function frameDelay(entry: LogEntry | null, base: number): number {
  if (!entry) return base
  const f = entry.flags ?? []
  if (f.includes('kill')) return Math.round(base * 1.7)
  if (f.includes('crit')) return Math.round(base * 1.35)
  if (entry.type === 'system' || f.includes('dot') || f.includes('wait') || f.includes('recoil')) return Math.round(base * 0.5)
  if (f.includes('dodge') || f.includes('block')) return Math.round(base * 0.85)
  return base
}

/** An end-of-turn regeneration tick: a self-targeted heal (a rigen synergy/relic heals
 *  every unit at once, one log entry per unit). We detect these to reveal the whole
 *  batch in a SINGLE step so the team heals simultaneously instead of one-by-one. */
function isRegenTick(e: LogEntry | null): boolean {
  return !!e && e.type === 'Cura' && e.actorId === e.targetId && (e.flags ?? []).includes('heal')
}

/** If `from` lands on a regen tick, return the last consecutive same-turn regen-tick
 *  frame index (so advancing to it applies every unit's heal in one beat); else `from`. */
export function regenBatchEnd(frames: ReplayFrame[], from: number): number {
  const start = frames[from]?.entry ?? null
  if (!isRegenTick(start)) return from
  const turn = start!.turn
  let k = from
  while (k + 1 < frames.length) {
    const next = frames[k + 1]?.entry ?? null
    if (!isRegenTick(next) || next!.turn !== turn) break
    k++
  }
  return k
}

export interface BattleReplayController {
  frame: ReplayFrame
  index: number
  total: number
  /** First frame index at which every unit on the losing side has hp <= 0, or the
   *  last frame index as a fallback (e.g. a timeout win with survivors on both sides). */
  deathFrame: number
  hp: Record<string, number>
  entry: LogEntry | null
  /** Turn number of the current frame (0 before any action has played). */
  currentTurn: number
  playing: boolean
  done: boolean
  modalReady: boolean
  speed: ReplaySpeed
  play: () => void
  pause: () => void
  toggle: () => void
  skip: () => void
  setSpeed: (s: ReplaySpeed) => void
  step: () => void
  stepBack: () => void
}

/**
 * Plays a pre-computed battle Replay step-by-step. The engine already decided
 * the whole fight; this only paces the reveal so HP bars and the log animate.
 * Skip jumps straight to the final frame so the player can settle the result.
 */
export function useBattleReplay(
  replay: Replay,
  opts: { autoPlay?: boolean; stepMs?: number } = {},
): BattleReplayController {
  const stepMs = opts.stepMs ?? 1200
  const autoPlay = opts.autoPlay ?? true
  const total = replay.frames.length

  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(autoPlay)
  const [speed, setSpeed] = useState<ReplaySpeed>(1)
  const [modalReady, setModalReady] = useState(false)
  const replayRef = useRef(replay)

  // New battle → rewind to the start.
  useEffect(() => {
    if (replayRef.current !== replay) {
      replayRef.current = replay
      setIndex(0)
      setPlaying(autoPlay)
      setSpeed(1)
    }
  }, [replay, autoPlay])

  const done = index >= total - 1

  // The engine appends trailing WINNER-side frames after the killing blow (regen ticks,
  // fatigue, wait turns) — so the LAST frame is not when the fight is visually decided.
  // Find the earliest frame where every unit on the losing side has hp <= 0 instead, and
  // gate the victory modal off that. Falls back to the last frame when no such frame
  // exists (a timeout win: both sides have survivors at turnCap).
  const deathFrame = (() => {
    const losingSide = replay.winner === 'left' ? 'right' : 'left'
    const losingKeys = replay.units.filter(u => u.side === losingSide).map(u => u.key)
    if (losingKeys.length === 0) return total - 1
    for (let i = 0; i < total; i++) {
      const hp = replay.frames[i]!.hp
      if (losingKeys.every(k => (hp[k] ?? 0) <= 0)) return i
    }
    return total - 1
  })()

  useEffect(() => {
    if (!playing || done) return
    // Dwell longer on the frame just revealed if it's a big moment, shorter if it's a
    // trivial tick — the current frame's entry drives how long it stays on screen.
    const delay = frameDelay(replay.frames[index]?.entry ?? null, stepMs) / speed
    const t = setTimeout(() => setIndex(i => regenBatchEnd(replay.frames, Math.min(total - 1, i + 1))), delay)
    return () => clearTimeout(t)
  }, [playing, done, index, speed, total, stepMs, replay])

  useEffect(() => { if (done) setPlaying(false) }, [done])

  useEffect(() => {
    if (index < deathFrame) { setModalReady(false); return }
    const t = setTimeout(() => setModalReady(true), POST_DEATH_DELAY_MS)
    return () => clearTimeout(t)
  }, [index, deathFrame])

  const play = useCallback(() => setPlaying(true), [])
  const pause = useCallback(() => setPlaying(false), [])
  const toggle = useCallback(() => setPlaying(p => !p), [])
  const skip = useCallback(() => { setIndex(total - 1); setPlaying(false); setModalReady(true) }, [total])
  const step = useCallback(() => {
    setPlaying(false)
    setIndex(i => regenBatchEnd(replay.frames, Math.min(total - 1, i + 1)))
  }, [total, replay])
  const stepBack = useCallback(() => {
    setPlaying(false)
    setIndex(i => Math.max(0, i - 1))
  }, [])

  const frame = replay.frames[Math.min(index, total - 1)]!
  // Frame 0 has no entry (pre-combat state) — walk back to the nearest played
  // frame's turn so callers always get a sensible turn number, even at the start.
  let currentTurn = frame.entry?.turn ?? 0
  if (frame.entry == null) {
    for (let i = Math.min(index, total - 1) - 1; i >= 0; i--) {
      const t = replay.frames[i]?.entry?.turn
      if (t != null) { currentTurn = t; break }
    }
  }
  return {
    frame,
    index,
    total,
    deathFrame,
    hp: frame.hp,
    entry: frame.entry,
    currentTurn,
    playing,
    done,
    modalReady,
    speed,
    play,
    pause,
    toggle,
    skip,
    setSpeed,
    step,
    stepBack,
  }
}
