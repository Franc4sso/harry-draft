'use client'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { useReducedMotion } from 'framer-motion'
import type { LogEntry } from '@/types'
import type { ReplayUnit } from '@/game/engine/combat/replay'
import { TARGET_REASON_LABEL } from '@/types'
import { liftMomentFor, type LiftMoment } from './liftMoment'
import { UnitBust } from './UnitBust'

/** Cinematic resting spot for a clone, as % of the overlay box (left/top = center anchor). */
type CloneSpot = { left: number; top: number; scale: number }

// Attacker: left-ish, smaller, in shadow. Target: right-ish, larger, lit up.
const ATTACKER_SPOT: CloneSpot = { left: 28, top: 50, scale: 1.1 }
const TARGET_SPOT: CloneSpot = { left: 70, top: 50, scale: 1.4 }

/**
 * Lift & Focus: al frame-chiave (uccisione, critico, primo scatto di un Duo) monta un overlay
 * che porta i due combattenti coinvolti al centro dell'attenzione + il nome-evento e, se
 * disponibile, la riga-causa (perché quel bersaglio). I due combattenti sono cloni fedeli
 * (veri `UnitBust`, non placeholder testuali): al mount i loro rect DOM reali vengono misurati
 * (stesso pattern di `PixiArena`) e i cloni volano (GSAP one-shot) dalla posizione originale
 * nella riga alla posa cinematografica — attaccante sinistra/ombra, bersaglio destra/luce.
 * Reduced-motion o rect non misurabili (jsdom) → cloni statici alle pose finali, nessun volo.
 * Fuori dai momenti chiave ritorna null: nessun nodo DOM, nessun costo.
 */
export function LiftFocus({
  entry, frameKey, units, firstDuo, speed, hp,
}: {
  entry: LogEntry | null
  frameKey: number
  units: ReplayUnit[]
  firstDuo: Map<string, number>
  speed: number
  /** Live per-unit HP (same map BattleArena feeds the row busts). The clone is visual —
   *  an exact HP isn't load-bearing, but reusing the live map keeps it truthful for free. */
  hp?: Record<string, number>
}) {
  const reduced = !!useReducedMotion()
  const lastFiredRef = useRef(0)
  const [active, setActive] = useState<{ moment: LiftMoment; entry: LogEntry; key: number } | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const attackerCloneRef = useRef<HTMLDivElement>(null)
  const targetCloneRef = useRef<HTMLDivElement>(null)
  // Active GSAP timeline, killed on unmount/onComplete — same pattern as PixiArena's activeTls.
  const tlRef = useRef<gsap.core.Timeline | null>(null)

  useEffect(() => {
    if (frameKey === 0 || lastFiredRef.current === frameKey) return
    lastFiredRef.current = frameKey
    const moment = liftMomentFor(entry, frameKey, firstDuo)
    setActive(moment && entry ? { moment, entry, key: frameKey } : null)
  }, [frameKey, entry, firstDuo])

  useEffect(() => {
    if (!active) return
    const dur = reduced ? 700 : Math.max(900, 2200 / speed)
    const t = setTimeout(() => setActive(null), dur)
    return () => clearTimeout(t)
  }, [active, reduced, speed])

  // FLIP: measure the ORIGINAL row-bust rects (real DOM, same pattern as PixiArena.tsx's
  // centerPct), then fly the overlay clones from there to their cinematic spot. jsdom (tests)
  // and reduced-motion both skip the tween — the clones just land on the final spot.
  useLayoutEffect(() => {
    tlRef.current?.kill()
    tlRef.current = null
    if (!active) return
    const overlay = overlayRef.current
    const attackerEl = attackerCloneRef.current
    const targetEl = targetCloneRef.current
    if (!overlay || !attackerEl || !targetEl) return

    const place = (el: HTMLDivElement, spot: CloneSpot) => {
      gsap.set(el, { left: `${spot.left}%`, top: `${spot.top}%`, xPercent: -50, yPercent: -50, scale: spot.scale, filter: 'none' })
    }

    if (reduced) {
      place(attackerEl, ATTACKER_SPOT)
      place(targetEl, TARGET_SPOT)
      return
    }

    const { entry: e } = active
    const box = overlay.getBoundingClientRect()
    const originRect = (side?: string, id?: string) => {
      if (!side || !id) return null
      const el = document.querySelector(`[data-unit-key="${CSS.escape(`${side}:${id}`)}"]`)
      return el ? el.getBoundingClientRect() : null
    }
    const originPct = (r: DOMRect) => ({
      left: ((r.left + r.width / 2 - box.left) / box.width) * 100,
      top: ((r.top + r.height / 2 - box.top) / box.height) * 100,
    })

    const attackerOrigin = box.width > 0 && box.height > 0 ? originRect(e.actorSide, e.actorId) : null
    const targetOrigin = box.width > 0 && box.height > 0 ? originRect(e.targetSide, e.targetId) : null

    // Fallback rect-0 (jsdom / no real layout): land the clones on the final cinematic
    // spot directly — no crash, no flight, matches what the reduced-motion path does.
    if (!attackerOrigin || !targetOrigin) {
      place(attackerEl, ATTACKER_SPOT)
      place(targetEl, TARGET_SPOT)
      return
    }

    gsap.set(attackerEl, { ...originPct(attackerOrigin), xPercent: -50, yPercent: -50, scale: 1, filter: 'none' })
    gsap.set(targetEl, { ...originPct(targetOrigin), xPercent: -50, yPercent: -50, scale: 1, filter: 'none' })

    const dur = Math.max(0.35, 0.8 / speed)
    const tl = gsap.timeline({
      onComplete: () => { tlRef.current = null },
    })
    tl.to(attackerEl, {
      left: `${ATTACKER_SPOT.left}%`, top: `${ATTACKER_SPOT.top}%`, scale: ATTACKER_SPOT.scale,
      filter: 'brightness(0.55)', duration: dur, ease: 'power3.out',
    }, 0)
    tl.to(targetEl, {
      left: `${TARGET_SPOT.left}%`, top: `${TARGET_SPOT.top}%`, scale: TARGET_SPOT.scale,
      filter: 'brightness(1.2)', duration: dur, ease: 'power3.out',
    }, 0)
    tlRef.current = tl
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, reduced])

  // Kill any in-flight timeline on unmount — never keep ticking on destroyed nodes.
  useEffect(() => () => { tlRef.current?.kill() }, [])

  if (!active) return null
  const { entry: e, moment } = active
  const attacker = units.find(u => u.key === `${e.actorSide}:${e.actorId}`)
  const target = units.find(u => u.key === `${e.targetSide}:${e.targetId}`)
  const cause = e.reason ? TARGET_REASON_LABEL[e.reason] : null
  const eventName = moment.kind === 'duo' ? moment.duoName : moment.kind === 'kill' ? 'Esecuzione' : 'Critico'

  return (
    <div
      key={active.key}
      ref={overlayRef}
      data-testid="lift-focus"
      aria-hidden
      className="pointer-events-none absolute inset-0 z-30 overflow-hidden"
    >
      {/* backdrop scuro */}
      <div className="absolute inset-0 bg-black/70" />
      {/* clone attaccante: fedele (vero UnitBust), piccolo, in ombra — parte dalla riga e vola qui */}
      {attacker && (
        <div ref={attackerCloneRef} className="absolute" style={{ left: '50%', top: '50%' }}>
          <UnitBust unit={attacker} hp={hp?.[attacker.key] ?? attacker.maxHp} compact />
        </div>
      )}
      {/* clone bersaglio: fedele (vero UnitBust), grande, in luce — parte dalla riga e vola qui */}
      {target && (
        <div ref={targetCloneRef} className="absolute" style={{ left: '50%', top: '50%' }}>
          <UnitBust unit={target} hp={hp?.[target.key] ?? target.maxHp} />
        </div>
      )}
      {/* nome-evento */}
      <div className="pointer-events-none absolute left-1/2 top-[18%] -translate-x-1/2 whitespace-nowrap font-display text-2xl uppercase text-[#f3e6c4]">
        {eventName}
      </div>
      {cause && (
        <div
          data-testid="lift-cause"
          className="pointer-events-none absolute bottom-[18%] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-[#3a5680] bg-black/85 px-4 py-1.5 text-sm font-bold text-[#efe7d2]"
        >
          💔 <span className="text-[#7dd3fc]">{cause}</span>
        </div>
      )}
    </div>
  )
}
