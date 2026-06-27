'use client'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import type { RunSummary } from '@/lib/runSummary'

export function AreaClearedScreen({
  area, areasTotal, summary, onContinue,
}: {
  area: number
  areasTotal: number
  summary: RunSummary
  onContinue: () => void
}) {
  return (
    <main className="flex-1 flex flex-col items-center justify-center gap-6 p-8 text-center">
      <motion.h1 initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
        className="font-display text-4xl text-gold">
        Area {area + 1} completata
      </motion.h1>
      <p className="text-white/70">Prossima area: {Math.min(area + 2, areasTotal)} / {areasTotal}</p>
      <div className="glass rounded-xl p-5 flex gap-6 text-sm">
        <span>Squadra: {summary.teamSize}</span>
        <span>Livello medio: {summary.avgLevel}</span>
        <span>Reliquie: {summary.relics}</span>
      </div>
      <Button variant="primary" onClick={onContinue}>Prosegui</Button>
    </main>
  )
}
