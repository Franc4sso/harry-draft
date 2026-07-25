'use client'
import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'
import type { LogEntry } from '@/types'
import { createPixiStage, type PixiStage } from '@/lib/vfx/PixiStage'
import { choreograph } from '@/lib/vfx/choreograph'
import { heatAmp } from '@/lib/vfx/crescendo'
import { spellVfxFor } from '@/lib/vfx/spellVfx'

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
  entry, frameKey, speed, intensity = 0,
}: {
  entry: LogEntry | null
  frameKey: number
  speed: number
  /** Calore del combattimento 0..1 (crescendo). Default 0 = scena identica a prima. */
  intensity?: number
}) {
  const reduced = !!useReducedMotion()
  const mountRef = useRef<HTMLDivElement>(null)
  const screenRef = useRef<HTMLDivElement>(null)
  const tintRef = useRef<HTMLDivElement>(null)
  const roomRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<PixiStage | null>(null)
  const lastFiredRef = useRef(0)
  // Active GSAP timelines, killed on unmount so none keep ticking on destroyed Pixi objects.
  const activeTls = useRef<Set<NonNullable<ReturnType<typeof choreograph>>>>(new Set())

  // Latest values, read inside the frameKey-keyed effect so it doesn't need
  // to depend on (and re-fire for) entry/speed changing mid-frame.
  const entryRef = useRef(entry)
  const speedRef = useRef(speed)
  const intensityRef = useRef(intensity)
  entryRef.current = entry
  speedRef.current = speed
  intensityRef.current = intensity

  // CALORE DELLA STANZA — ciò che rende il crescendo visibile anche TRA un colpo e l'altro:
  // un alone caldo che sale con la streak e si spegne nei frame fiacchi. Guidato per stile
  // (non per re-render) così il layer resta fuori dal ciclo di React, e tenuto sotto 0.12 di
  // opacità: HP, log, callout, barra iniziativa e numeri di danno non devono MAI sbiadire.
  useEffect(() => {
    const el = roomRef.current
    if (!el) return
    el.style.opacity = reduced ? '0' : String(heatAmp(intensity).room)
  }, [intensity, reduced])

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

  // Gentle reactive lighting: the room catches a soft tint of the spell's colour and lets it
  // go — eases in ~0.3s, out ~0.6s, peak opacity 0.10, NEVER a flash. Deliberately quieter than
  // the tier-3 `onScreen` wash (which is reserved for ultimates and skips this).
  const onTint = (color: number, amount: number) => {
    const el = tintRef.current
    if (!el || reduced || typeof el.animate !== 'function') return // no-op where WAAPI is absent (jsdom)
    el.style.background = `radial-gradient(120% 100% at 50% 52%, #${color.toString(16).padStart(6, '0')}, transparent 76%)`
    el.animate([{ opacity: 0 }, { opacity: amount, offset: 0.33 }, { opacity: amount, offset: 0.5 }, { opacity: 0 }], { duration: 900, easing: 'ease-in-out' })
  }

  useEffect(() => {
    if (frameKey === 0) return
    if (lastFiredRef.current === frameKey) return
    lastFiredRef.current = frameKey
    const entry = entryRef.current
    if (!entry || reduced) return
    // Gentle reactive tint — a DOM overlay, so it plays even where WebGL is unavailable.
    // Skip basic attacks (keeps the room from tinting on every jab) and tier-3 spells (they
    // already cast the bright `onScreen` wash).
    const amp = heatAmp(intensityRef.current)
    const cfg = spellVfxFor(entry.action)
    if (cfg && !cfg.screen && entry.action.trim().toLowerCase() !== 'colpo base') onTint(cfg.color.glow, Math.min(0.2, 0.1 * amp.tint))

    const stage = stageRef.current
    const mount = mountRef.current
    if (!stage || !mount) return

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
    // A DoT tick (veleno/ustione) is NOT an attack cast this turn — the damage rises on the
    // already-poisoned victim, so it has no acting source. Anchoring the VFX to the caster made
    // the poison "shoot" from the poisoner's card even after that mage had died. Treat dot ticks
    // like self/heal effects: no `from`, the effect plays on the target only.
    const isDotTick = entry.flags.includes('dot')
    const from = isDotTick ? null : centerPct(entry.actorSide, entry.actorId)
    const to = centerPct(entry.targetSide, entry.targetId)

    const speed = speedRef.current
    const budgetMs = Math.max(700, Math.round(1200 / speed))
    const tl = choreograph(stage, { entry, from, to, budgetMs, intensity: intensityRef.current, reduced, audio: null, onScreen })
    if (tl) {
      const set = activeTls.current
      set.add(tl)
      tl.eventCallback('onComplete', () => set.delete(tl))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameKey])

  return (
    <>
      {/* calore della stanza — sotto tutto, opacità guidata dal crescendo (max 0.12) */}
      <div
        ref={roomRef}
        aria-hidden
        data-room-heat
        className="pointer-events-none absolute inset-0 z-[2] opacity-0"
        style={{
          background: 'radial-gradient(120% 95% at 50% 60%, rgba(255,138,58,0.85), rgba(224,90,74,0.35) 45%, transparent 74%)',
          mixBlendMode: 'screen',
          transition: 'opacity 700ms cubic-bezier(.33,1,.68,1)',
        }}
      />
      <div ref={mountRef} className="pointer-events-none absolute inset-0 z-[5]" />
      <div ref={tintRef} aria-hidden className="pointer-events-none absolute inset-0 z-[3] opacity-0" style={{ mixBlendMode: 'screen' }} />
      <div ref={screenRef} aria-hidden className="pointer-events-none absolute inset-0 z-[4] opacity-0" style={{ mixBlendMode: 'screen' }} />
    </>
  )
}
