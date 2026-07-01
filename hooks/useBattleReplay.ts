'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import type { LogEntry } from '@/types'
import type { Replay, ReplayFrame } from '@/game/engine/combat/replay'

export const REPLAY_SPEEDS = [1, 2, 4] as const
export type ReplaySpeed = (typeof REPLAY_SPEEDS)[number]

const POST_DEATH_DELAY_MS = 700

export interface BattleReplayController {
  frame: ReplayFrame
  index: number
  total: number
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

  useEffect(() => {
    if (!playing || done) return
    const t = setTimeout(() => setIndex(i => Math.min(total - 1, i + 1)), stepMs / speed)
    return () => clearTimeout(t)
  }, [playing, done, index, speed, total, stepMs])

  useEffect(() => { if (done) setPlaying(false) }, [done])

  useEffect(() => {
    if (!done) { setModalReady(false); return }
    const t = setTimeout(() => setModalReady(true), POST_DEATH_DELAY_MS)
    return () => clearTimeout(t)
  }, [done])

  const play = useCallback(() => setPlaying(true), [])
  const pause = useCallback(() => setPlaying(false), [])
  const toggle = useCallback(() => setPlaying(p => !p), [])
  const skip = useCallback(() => { setIndex(total - 1); setPlaying(false); setModalReady(true) }, [total])
  const step = useCallback(() => {
    setPlaying(false)
    setIndex(i => Math.min(total - 1, i + 1))
  }, [total])
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
