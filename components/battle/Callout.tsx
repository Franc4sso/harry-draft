'use client'
import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import type { LogEntry } from '@/types'

/**
 * Maps a log entry's flags to the big centered callout word + tone, mirroring
 * `/combat-lab`'s `calloutFor`. Unlike the lab (which infers an `ImpactKind`
 * from UI state), the real game already carries every relevant flag
 * (`crit`/`kill`/`block`/`dodge`/`heal`/`dot`) on the entry itself.
 */
export function calloutFor(entry: LogEntry | null): { text: string; tone: string } | null {
  if (!entry) return null
  const flags = entry.flags ?? []
  if (flags.includes('crit') && flags.includes('kill')) return { text: 'ESECUZIONE', tone: '#e05a4a' }
  if (flags.includes('crit')) return { text: 'CRITICO', tone: '#f6e6a8' }
  if (flags.includes('block')) return { text: 'PARATO', tone: '#8ec9ff' }
  if (flags.includes('dodge')) return { text: 'SCHIVA', tone: '#8ec9ff' }
  if (flags.includes('heal')) return { text: 'CURA', tone: '#79e6a0' }
  if (flags.includes('dot')) return { text: 'VELENO', tone: '#a9de5c' }
  return null
}

/**
 * Big centered "callout" word (CRITICO / PARATO / ESECUZIONE / …) that
 * flashes over the real arena on notable events — the readable "state
 * signature" companion to the Pixi VFX layer. Fires once per new `frameKey`
 * (never re-fires for the same frame) and auto-clears itself; it never
 * duplicates `UnitBust`'s floating damage/heal numbers. Respects
 * `prefers-reduced-motion`: a brief static word instead of the scale/blur
 * flash-then-fade.
 */
export function Callout({ entry, frameKey }: { entry: LogEntry | null; frameKey: number }) {
  const reduced = !!useReducedMotion()
  const lastFiredRef = useRef(0)
  const [callout, setCallout] = useState<{ text: string; tone: string; key: number } | null>(null)

  useEffect(() => {
    if (frameKey === 0) return
    if (lastFiredRef.current === frameKey) return
    lastFiredRef.current = frameKey
    const co = calloutFor(entry)
    setCallout(co ? { ...co, key: frameKey } : null)
  }, [frameKey, entry])

  useEffect(() => {
    if (!callout) return
    const t = setTimeout(() => setCallout(null), reduced ? 700 : 1300)
    return () => clearTimeout(t)
  }, [callout, reduced])

  if (!callout) return null

  return (
    <div
      key={callout.key}
      data-testid="battle-callout"
      aria-hidden
      className="pointer-events-none absolute left-1/2 top-[38%] z-20 -translate-x-1/2 -translate-y-1/2 select-none whitespace-nowrap font-display text-4xl font-bold uppercase tracking-[0.12em] sm:text-5xl"
      style={{
        color: callout.tone,
        textShadow: `0 0 30px ${callout.tone}, 0 4px 12px rgba(0,0,0,.8)`,
        animation: reduced ? undefined : 'battleCallout 1.3s cubic-bezier(.22,1,.36,1)',
      }}
    >
      {callout.text}
    </div>
  )
}
