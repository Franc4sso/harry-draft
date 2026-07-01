'use client'
import { useEffect, useRef } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Button } from '@/components/ui/Button'

/**
 * End-of-battle modal: a dimmed premium overlay with the outcome and a single
 * action, so the player never hunts for a "continue" button. Shown after the
 * replay finishes. Esc or the button confirm.
 */
export function BattleEndModal({
  outcome, timedOut, onConfirm,
}: {
  outcome: 'win' | 'loss'
  timedOut?: boolean
  onConfirm: () => void
}) {
  const reduce = useReducedMotion()
  const wrapRef = useRef<HTMLDivElement>(null)
  const win = outcome === 'win'
  const timeoutWin = win && !!timedOut

  useEffect(() => {
    wrapRef.current?.querySelector('button')?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onConfirm() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onConfirm])

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
        className="w-full max-w-sm rounded-2xl border border-[#C9A24B]/40 bg-[rgba(20,16,33,0.92)] px-6 py-7 text-center shadow-[0_0_40px_rgba(201,162,75,0.18)]"
      >
        <h2 className={win ? 'font-display text-3xl text-[#F0D98A]' : 'font-display text-3xl text-rose-300'}>
          {timeoutWin ? 'Vittoria ai punti' : win ? 'Vittoria' : 'Sconfitta'}
        </h2>
        <p className="mt-2 text-sm text-white/55">
          {timeoutWin
            ? 'Tempo scaduto — vinci per PV residui.'
            : win ? 'La squadra avversaria è stata sconfitta.' : 'La tua squadra è caduta.'}
        </p>
        <div ref={wrapRef} className="mt-6">
          <Button onClick={onConfirm}>
            {win ? 'Continua' : 'Vedi esito'}
          </Button>
        </div>
      </motion.div>
    </div>
  )
}
