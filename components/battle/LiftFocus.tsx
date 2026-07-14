'use client'
import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import type { LogEntry } from '@/types'
import type { ReplayUnit } from '@/game/engine/combat/replay'
import { TARGET_REASON_LABEL } from '@/types'
import { liftMomentFor, type LiftMoment } from './liftMoment'

/**
 * Lift & Focus: al frame-chiave (uccisione, critico, primo scatto di un Duo) monta un overlay
 * che porta i due combattenti coinvolti al centro dell'attenzione + il nome-evento e, se
 * disponibile, la riga-causa (perché quel bersaglio). Fase statica: nessun volo animato ancora
 * (arriva nel Task 3) — solo comparsa/scomparsa one-shot, keyed su frameKey come `Callout`.
 * Fuori dai momenti chiave ritorna null: nessun nodo DOM, nessun costo.
 */
export function LiftFocus({
  entry, frameKey, units, firstDuo, speed,
}: {
  entry: LogEntry | null
  frameKey: number
  units: ReplayUnit[]
  firstDuo: Map<string, number>
  speed: number
}) {
  const reduced = !!useReducedMotion()
  const lastFiredRef = useRef(0)
  const [active, setActive] = useState<{ moment: LiftMoment; entry: LogEntry; key: number } | null>(null)

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

  if (!active) return null
  const { entry: e, moment } = active
  const attacker = units.find(u => u.key === `${e.actorSide}:${e.actorId}`)
  const target = units.find(u => u.key === `${e.targetSide}:${e.targetId}`)
  const cause = e.reason ? TARGET_REASON_LABEL[e.reason] : null
  const eventName = moment.kind === 'duo' ? moment.duoName : moment.kind === 'kill' ? 'Esecuzione' : 'Critico'

  return (
    <div
      key={active.key}
      data-testid="lift-focus"
      aria-hidden
      className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center"
    >
      {/* backdrop scuro */}
      <div className="absolute inset-0 bg-black/70" />
      {/* per ora: due cloni statici affiancati al centro (il volo arriva al Task 3) */}
      <div className="relative flex items-center gap-8">
        {/* clone attaccante (piccolo, in ombra) + clone bersaglio (grande, luce) — vedi Task 3 per UnitBust */}
        <div className="text-sm text-[#efe7d2]/70">{attacker?.name}</div>
        <div className="text-lg font-bold text-[#efe7d2]">{target?.name}</div>
        {/* nome-evento */}
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap font-display text-2xl uppercase text-[#f3e6c4]">
          {eventName}
        </div>
        {cause && (
          <div
            data-testid="lift-cause"
            className="absolute -bottom-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-[#3a5680] bg-black/85 px-4 py-1.5 text-sm font-bold text-[#efe7d2]"
          >
            💔 <span className="text-[#7dd3fc]">{cause}</span>
          </div>
        )}
      </div>
    </div>
  )
}
