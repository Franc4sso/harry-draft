'use client'
import { motion, useReducedMotion } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { Frame } from '@/components/ui/Frame'
import { Insegna } from '@/components/ui/Insegna'
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
      <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-6">
        <Reveal>
          <Insegna kicker="Capitolo chiuso" title={`Area ${area + 1} completata`} />
        </Reveal>
        <motion.p
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.35, ease: EASE_CINEMATIC }}
          className="text-white/70"
        >
          Prossima area: {Math.min(area + 2, areasTotal)} / {areasTotal}
        </motion.p>
        <motion.p
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.5, ease: EASE_CINEMATIC }}
          className="text-emerald-300/90"
        >
          La squadra si è ripresa: tutti tornano in piena salute.
        </motion.p>
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 14, filter: 'blur(5px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.5, delay: 0.45, ease: EASE_CINEMATIC }}
          className="w-full"
        >
          <Frame variant="panel" innerClassName="flex flex-wrap justify-center gap-6 p-5 text-sm">
            <span>Squadra: {summary.teamSize}</span>
            <span>Livello medio: {summary.avgLevel}</span>
            <span>Reliquie: {summary.relics}</span>
          </Frame>
        </motion.div>
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.6, ease: EASE_CINEMATIC }}
        >
          <Button variant="primary" onClick={onContinue}>Prosegui</Button>
        </motion.div>
      </div>
    </main>
  )
}
