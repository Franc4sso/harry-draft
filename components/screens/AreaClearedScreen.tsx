'use client'
import { motion, useReducedMotion } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { Reveal, EASE_CINEMATIC } from '@/components/ui/motion'
import type { RunSummary } from '@/lib/runSummary'

export function AreaClearedScreen({
  area, areasTotal, summary, onContinue,
}: {
  area: number
  areasTotal: number
  summary: RunSummary
  onContinue: () => void
}) {
  const reduce = useReducedMotion()
  return (
    <main className="flex-1 flex flex-col items-center justify-center gap-6 p-8 text-center">
      <Reveal>
        <p className="kicker">Capitolo chiuso</p>
        <h1 className="title-gradient mt-1 font-display text-5xl font-bold">
          Area {area + 1} completata
        </h1>
        <div aria-hidden className="mx-auto mt-3 h-px w-56" style={{ background: 'linear-gradient(90deg, transparent, rgba(202,162,74,0.6), transparent)' }} />
      </Reveal>
      <motion.p
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.35, ease: EASE_CINEMATIC }}
        className="text-white/70"
      >
        Prossima area: {Math.min(area + 2, areasTotal)} / {areasTotal}
      </motion.p>
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 14, filter: 'blur(5px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.5, delay: 0.45, ease: EASE_CINEMATIC }}
        className="panel-premium flex gap-6 rounded-xl p-5 text-sm"
      >
        <span>Squadra: {summary.teamSize}</span>
        <span>Livello medio: {summary.avgLevel}</span>
        <span>Reliquie: {summary.relics}</span>
      </motion.div>
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.6, ease: EASE_CINEMATIC }}
      >
        <Button variant="primary" onClick={onContinue}>Prosegui</Button>
      </motion.div>
    </main>
  )
}
