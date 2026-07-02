'use client'
import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Sparkles, Skull, Copy, Check } from 'lucide-react'
import { Frame } from '@/components/ui/Frame'
import { Button } from '@/components/ui/Button'
import { FoilText, EASE_CINEMATIC } from '@/components/ui/motion'

/** Terminal campaign screen: triumphant win or run-ending defeat.
 *  Two distinct moods: win is warm gold and quick; defeat is cold,
 *  desaturated and deliberately slower. */
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
  const reduce = useReducedMotion()
  const [copied, setCopied] = useState(false)
  const beat = won ? 1 : 1.75 // defeat breathes slower — cold scene, deliberate pacing

  const copySeed = () => {
    void navigator.clipboard?.writeText(seed)
    setCopied(true)
  }

  return (
    <main className="relative flex-1 flex flex-col items-center justify-center gap-8 p-8 text-center">
      {/* Mood wash: warm gold halo for a win, cold blue-grey pall for a defeat. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div
          className="absolute left-1/2 top-[-10%] h-[40rem] w-[46rem] -translate-x-1/2 rounded-full blur-[130px]"
          style={{
            background: won
              ? 'radial-gradient(circle, rgba(202,162,74,0.20), transparent 60%)'
              : 'radial-gradient(circle, rgba(70,85,110,0.22), transparent 60%)',
          }}
        />
      </div>

      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={
          won
            ? { type: 'spring', stiffness: 200, damping: 16 }
            : { duration: 1.1 * beat, ease: EASE_CINEMATIC }
        }
        className="relative flex flex-col items-center gap-3"
      >
        {won ? (
          <Sparkles size={56} className="text-amber-300" style={{ filter: 'drop-shadow(0 0 20px rgba(245,196,81,0.6))' }} />
        ) : (
          <motion.span
            initial={reduce ? false : { y: -6 }}
            animate={{ y: 0 }}
            transition={{ duration: 1.4, ease: 'easeOut' }}
          >
            <Skull size={56} className="text-slate-400/70" />
          </motion.span>
        )}
        {won ? (
          <FoilText as="h1" className="font-display text-5xl font-bold">
            Campione!
          </FoilText>
        ) : (
          <h1 className="font-display text-5xl font-bold text-slate-300/85">Sconfitta</h1>
        )}
        <p className={`max-w-md text-sm ${won ? 'text-white/55' : 'text-slate-400/70'}`}>
          {won
            ? 'Hai battuto tutte le squadre e il Boss Finale. La tua leggenda è completa.'
            : stageReached > enemyCount
              ? 'Sei caduto contro il Boss Finale. La prossima volta andrà meglio.'
              : `La tua squadra è stata annientata alla sfida ${stageReached} di ${enemyCount}.`}
        </p>
      </motion.div>

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 * beat, delay: 0.45 * beat, ease: EASE_CINEMATIC }}
      >
        <Frame
          variant="panel"
          className={won ? '' : 'saturate-50'}
          innerClassName="px-5 py-3 flex items-center gap-3"
        >
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
        </Frame>
      </motion.div>

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 * beat, delay: 0.65 * beat, ease: EASE_CINEMATIC }}
      >
        <Button onClick={onRestart}>Nuova run</Button>
      </motion.div>
    </main>
  )
}
