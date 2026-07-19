'use client'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useTutorial } from './TutorialProvider'

export function TutorialOverlay() {
  const { visibleStep, advance, skip } = useTutorial()
  const [rect, setRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    if (!visibleStep) { setRect(null); return }
    const el = document.querySelector<HTMLElement>(`[data-testid="${visibleStep.anchor}"]`)
    setRect(el ? el.getBoundingClientRect() : null)
  }, [visibleStep])

  if (!visibleStep) return null

  // Position the card near the anchor; fall back to centered.
  const cardStyle: React.CSSProperties = rect
    ? { position: 'fixed', top: Math.min(rect.bottom + 12, window.innerHeight - 180), left: Math.max(12, rect.left) }
    : { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }

  return (
    <div className="pointer-events-none fixed inset-0 z-[100]">
      {/* dim scrim (no shake, fade only) */}
      <motion.div className="absolute inset-0 bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
      {/* highlight ring around the anchor */}
      {rect && (
        <div
          className="absolute rounded-xl ring-2 ring-[#f3e6a0]"
          style={{ top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12, boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)' }}
        />
      )}
      <motion.div
        data-testid="tutorial-coachmark"
        className="pointer-events-auto max-w-xs rounded-xl border border-gold/50 bg-[#141024] p-4 text-left shadow-xl"
        style={cardStyle}
        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      >
        <p className="font-display text-sm font-semibold text-[#f3e6c4]">{visibleStep.title}</p>
        <p className="mt-1 text-xs leading-snug text-white/70">{visibleStep.body}</p>
        <div className="mt-3 flex items-center justify-between">
          <button type="button" onClick={skip} className="text-[11px] uppercase tracking-wide text-white/40 hover:text-white/70">
            Salta tutorial
          </button>
          <button type="button" onClick={advance} className="rounded-lg bg-gold/20 px-3 py-1 text-xs font-semibold text-gold hover:bg-gold/30">
            Avanti
          </button>
        </div>
      </motion.div>
    </div>
  )
}
