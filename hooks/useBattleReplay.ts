'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import type { LogEntry } from '@/types'
import type { Replay, ReplayFrame } from '@/game/engine/combat/replay'

export const REPLAY_SPEEDS = [1, 2, 4] as const
export type ReplaySpeed = (typeof REPLAY_SPEEDS)[number]

export interface BattleReplayController {
  frame: ReplayFrame
  index: number
  total: number
  hp: Record<string, number>
  entry: LogEntry | null
  playing: boolean
  done: boolean
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

  const play = useCallback(() => setPlaying(true), [])
  const pause = useCallback(() => setPlaying(false), [])
  const toggle = useCallback(() => setPlaying(p => !p), [])
  const skip = useCallback(() => { setIndex(total - 1); setPlaying(false) }, [total])
  const step = useCallback(() => {
    setPlaying(false)
    setIndex(i => Math.min(total - 1, i + 1))
  }, [total])
  const stepBack = useCallback(() => {
    setPlaying(false)
    setIndex(i => Math.max(0, i - 1))
  }, [])

  const frame = replay.frames[Math.min(index, total - 1)]!
  return {
    frame,
    index,
    total,
    hp: frame.hp,
    entry: frame.entry,
    playing,
    done,
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
