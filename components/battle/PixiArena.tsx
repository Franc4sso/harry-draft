'use client'
import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'
import type { LogEntry } from '@/types'
import { createPixiStage, type PixiStage } from '@/lib/vfx/PixiStage'
import { choreograph } from '@/lib/vfx/choreograph'

/**
 * Mounts the Pixi WebGL VFX layer inside the real BattleArena and drives it
 * from replay frames. Adapted from `app/combat-lab/page.tsx`'s mounting +
 * `onScreen` wash logic. Client-only: the stage is created in a `useEffect`
 * and destroyed on cleanup. When `prefers-reduced-motion` is set, no Pixi
 * stage is mounted at all — only the (inert) container divs render.
 *
 * Positions are measured HERE, from the live DOM at fire time (caster/target
 * bust centers as % of the canvas box), so every effect launches from the
 * actual wizard card toward its actual target — never a stale/lagged prop.
 */
export function PixiArena({
  entry, frameKey, speed,
}: {
  entry: LogEntry | null
  frameKey: number
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
  // to depend on (and re-fire for) entry/speed changing mid-frame.
  const entryRef = useRef(entry)
  const speedRef = useRef(speed)
  entryRef.current = entry
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
    const mount = mountRef.current
    if (!entry || reduced || !stage || !mount) return

    // Sync the renderer to the live arena size, then measure caster/target bust
    // centers from the DOM as % of the canvas box — effects align to the cards.
    try { stage.app.resize() } catch { /* ignore */ }
    const a = mount.getBoundingClientRect()
    if (a.width === 0 || a.height === 0) return
    const centerPct = (side?: string, id?: string) => {
      if (!side || !id) return null
      const el = document.querySelector(`[data-unit-key="${CSS.escape(`${side}:${id}`)}"]`)
      if (!el) return null
      const r = el.getBoundingClientRect()
      return {
        x: ((r.left + r.width / 2 - a.left) / a.width) * 100,
        y: ((r.top + r.height / 2 - a.top) / a.height) * 100,
      }
    }
    const from = centerPct(entry.actorSide, entry.actorId)
    const to = centerPct(entry.targetSide, entry.targetId)

    const speed = speedRef.current
    const budgetMs = Math.max(700, Math.round(1200 / speed))
    const tl = choreograph(stage, { entry, from, to, budgetMs, reduced, audio: null, onScreen })
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
