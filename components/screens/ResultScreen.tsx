'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, Skull, Copy, Check } from 'lucide-react'
import { GlowPanel } from '@/components/ui/GlowPanel'
import { Button } from '@/components/ui/Button'

/** Terminal campaign screen: triumphant win or run-ending defeat. */
export function ResultScreen({
  outcome, seed, stageReached, enemyCount, onRestart,
}: {
  outcome: 'win' | 'defeat'
  seed: string
  /** 1-based stage where the run ended (only meaningful for defeat). */
  stageReached: number
  enemyCount: number
  onRestart: () => void
}) {
  const won = outcome === 'win'
  const [copied, setCopied] = useState(false)

  const copySeed = () => {
    void navigator.clipboard?.writeText(seed)
    setCopied(true)
  }

  return (
    <main className="flex-1 flex flex-col items-center justify-center gap-8 p-8 text-center">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 16 }}
        className="flex flex-col items-center gap-3"
      >
        {won ? (
          <Sparkles size={56} className="text-amber-300" />
        ) : (
          <Skull size={56} className="text-white/50" />
        )}
        <h1 className={`font-display text-5xl ${won ? 'text-amber-100' : 'text-white/80'}`}>
          {won ? 'Campione!' : 'Sconfitta'}
        </h1>
        <p className="text-white/55 max-w-md text-sm">
          {won
            ? 'Hai battuto tutte le squadre e il Boss Finale. La tua leggenda è completa.'
            : stageReached > enemyCount
              ? 'Sei caduto contro il Boss Finale. La prossima volta andrà meglio.'
              : `La tua run si è fermata alla sfida ${stageReached} di ${enemyCount}.`}
        </p>
      </motion.div>

      <GlowPanel className="px-5 py-3 flex items-center gap-3">
        <p className="text-[11px] uppercase tracking-widest text-white/40">
          seed: <span className="text-white/70">{seed}</span>
        </p>
        <button
          type="button"
          onClick={copySeed}
          aria-label="Copia seed"
          className="flex items-center gap-1 text-[11px] uppercase tracking-widest text-white/50 hover:text-white transition-colors"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? 'Copiato!' : 'Copia seed'}
        </button>
      </GlowPanel>

      <Button onClick={onRestart}>Nuova run</Button>
    </main>
  )
}
