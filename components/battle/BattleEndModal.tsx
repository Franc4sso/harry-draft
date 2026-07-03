'use client'
import { useEffect, useRef } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/Button'

/**
 * End-of-battle modal: a dimmed premium overlay with the outcome and a single
 * primary action, so the player never hunts for a "continue" button. Shown
 * after the replay finishes. Esc or the button confirm; if `onClose` is
 * provided the modal is also dismissable (to review the settled board), and
 * Esc dismisses instead of confirming.
 */
export interface BattleSummary {
  mvpName: string
  mvpDealt: number
  bigHit?: { name: string; value: number }
}

export function BattleEndModal({
  outcome, timedOut, onConfirm, onClose, summary,
}: {
  outcome: 'win' | 'loss'
  timedOut?: boolean
  onConfirm: () => void
  onClose?: () => void
  /** Optional end-of-battle payoff: MVP + biggest hit. */
  summary?: BattleSummary
}) {
  const reduce = useReducedMotion()
  const wrapRef = useRef<HTMLDivElement>(null)
  const win = outcome === 'win'
  const timeoutWin = win && !!timedOut

  useEffect(() => {
    wrapRef.current?.querySelector('button')?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') (onClose ?? onConfirm)() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onConfirm, onClose])

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm p-6">
      <motion.div
        data-testid="battle-end-modal"
        role="dialog"
        aria-modal="true"
        aria-label={timeoutWin ? 'Vittoria ai punti' : win ? 'Vittoria' : 'Sconfitta'}
        initial={reduce ? false : { opacity: 0, scale: 0.92, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 26 }}
        className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-[#C9A24B]/40 bg-[rgba(20,16,33,0.92)] px-6 py-7 text-center shadow-[0_0_40px_rgba(201,162,75,0.18)]"
      >
        {/* Outcome flourish: a radiant halo behind the title — gold on a win, sombre rose on a loss —
            with rising sparks celebrating a victory. Purely decorative. */}
        {!reduce && (
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-0 h-28 overflow-hidden">
            <motion.div
              className="absolute left-1/2 top-1 h-24 w-40 -translate-x-1/2 rounded-full blur-2xl"
              style={{ background: win ? 'radial-gradient(circle, rgba(240,217,138,0.5), transparent 70%)' : 'radial-gradient(circle, rgba(244,63,94,0.32), transparent 70%)' }}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
            {win && Array.from({ length: 9 }).map((_, i) => (
              <motion.span
                key={i}
                className="absolute top-12 h-1 w-1 rounded-full bg-[#F0D98A]"
                style={{ left: `${14 + i * 8.5}%`, boxShadow: '0 0 6px rgba(240,217,138,0.9)' }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: [0, 1, 0], y: -30 }}
                transition={{ duration: 1.2, delay: 0.25 + i * 0.06, ease: 'easeOut' }}
              />
            ))}
          </div>
        )}
        <div className="relative z-10">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi"
            className="absolute right-3 top-3 rounded-full p-1.5 text-white/40 transition-colors hover:bg-white/10 hover:text-white/80"
          >
            <X size={18} />
          </button>
        )}
        <h2 className={win ? 'font-display text-3xl text-[#F0D98A]' : 'font-display text-3xl text-rose-300'}>
          {timeoutWin ? 'Vittoria ai punti' : win ? 'Vittoria' : 'Sconfitta'}
        </h2>
        <p className="mt-2 text-sm text-white/55">
          {timeoutWin
            ? 'Tempo scaduto — vinci per PV residui.'
            : win ? 'La squadra avversaria è stata sconfitta.' : 'La tua squadra è caduta.'}
        </p>
        {summary && summary.mvpDealt > 0 && (
          <div data-testid="battle-summary" className="mt-5 space-y-1.5 rounded-xl border border-[#C9A24B]/20 bg-black/25 px-4 py-3 text-left text-xs">
            <div className="flex items-center justify-between gap-3">
              <span className="uppercase tracking-wider text-white/45">MVP</span>
              <span className="truncate font-semibold text-[#F0D98A]">{summary.mvpName} · {summary.mvpDealt} danni</span>
            </div>
            {summary.bigHit && summary.bigHit.value > 0 && (
              <div className="flex items-center justify-between gap-3">
                <span className="uppercase tracking-wider text-white/45">Colpo più forte</span>
                <span className="truncate font-semibold text-rose-300">{summary.bigHit.name} · {summary.bigHit.value}</span>
              </div>
            )}
          </div>
        )}
        <div ref={wrapRef} className="mt-6">
          <Button onClick={onConfirm}>
            {win ? 'Continua' : 'Vedi esito'}
          </Button>
        </div>
        </div>
      </motion.div>
    </div>
  )
}
