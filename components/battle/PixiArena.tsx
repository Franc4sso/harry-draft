'use client'
import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'
import type { LogEntry } from '@/types'
import { createPixiStage, type PixiStage } from '@/lib/vfx/PixiStage'
import { choreograph } from '@/lib/vfx/choreograph'

/** A point on the arena, expressed as a percentage (0–100) of the arena box. */
type FxPoint = { x: number; y: number }

/**
 * Mounts the Pixi WebGL VFX layer inside the real BattleArena and drives it
 * from replay frames. Adapted from `app/combat-lab/page.tsx`'s mounting +
 * `onScreen` wash logic. Client-only: the stage is created in a `useEffect`
 * and destroyed on cleanup. When `prefers-reduced-motion` is set, no Pixi
 * stage is mounted at all — only the (inert) container divs render.
 */
export function PixiArena({
  entry, frameKey, from, to, speed,
}: {
  entry: LogEntry | null
  frameKey: number
  from?: FxPoint | null
  to?: FxPoint | null
  speed: number
}) {
  const reduced = !!useReducedMotion()
  const mountRef = useRef<HTMLDivElement>(null)
  const screenRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<PixiStage | null>(null)
  const lastFiredRef = useRef(0)
  // Active GSAP timelines, killed on unmount so none keep ticking on destroyed Pixi objects.
  const activeTls = useRef<Set<NonNullable<ReturnType<typeof choreograph>>>>(new Set())

  // Latest values, read inside the frameKey-keyed effect so it doesn't need
  // to depend on (and re-fire for) from/to/entry/speed changing mid-frame.
  const entryRef = useRef(entry)
  const fromRef = useRef(from)
  const toRef = useRef(to)
  const speedRef = useRef(speed)
  entryRef.current = entry
  fromRef.current = from
  toRef.current = to
  speedRef.current = speed

  useEffect(() => {
    if (reduced) return
    const el = mountRef.current
    if (!el) return
    let disposed = false
    let stage: PixiStage | null = null
    createPixiStage(el).then((s) => {
      if (disposed) { s.destroy(); return }
      stage = s
      stageRef.current = s
    }).catch(() => {
      // No WebGL/canvas support (e.g. jsdom in tests, or a headless env) —
      // fail silently; the arena still renders without the Pixi VFX layer.
    })
    return () => {
      disposed = true
      activeTls.current.forEach((t) => t.kill())
      activeTls.current.clear()
      stage?.destroy()
      stageRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced])

  const onScreen = (color: number) => {
    const el = screenRef.current
    if (!el || reduced) return
    el.style.background = `radial-gradient(circle, #${color.toString(16).padStart(6, '0')}, transparent 78%)`
    el.animate([{ opacity: 0 }, { opacity: 0.5, offset: 0.12 }, { opacity: 0 }], { duration: 600, easing: 'ease-out' })
  }

  useEffect(() => {
    if (frameKey === 0) return
    if (lastFiredRef.current === frameKey) return
    lastFiredRef.current = frameKey
    const stage = stageRef.current
    const entry = entryRef.current
    if (!entry) return
    if (reduced || !stage) return
    const speed = speedRef.current
    const budgetMs = Math.max(700, Math.round(1200 / speed))
    const tl = choreograph(stage, {
      entry, from: fromRef.current, to: toRef.current, budgetMs, reduced, audio: null, onScreen,
    })
    if (tl) {
      const set = activeTls.current
      set.add(tl)
      tl.eventCallback('onComplete', () => set.delete(tl))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameKey])

  return (
    <>
      <div ref={mountRef} className="pointer-events-none absolute inset-0 z-[5]" />
      <div ref={screenRef} aria-hidden className="pointer-events-none absolute inset-0 z-[4] opacity-0" style={{ mixBlendMode: 'screen' }} />
    </>
  )
}
