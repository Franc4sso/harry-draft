'use client'
import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Sparkles, Skull, Copy, Check } from 'lucide-react'
import { Frame } from '@/components/ui/Frame'
import { Button } from '@/components/ui/Button'
import { FoilText, EASE_CINEMATIC } from '@/components/ui/motion'
import type { RunReward } from '@/hooks/useRunB'

/** Terminal campaign screen: triumphant win or run-ending defeat.
 *  Two distinct moods: win is warm gold and quick; defeat is cold,
 *  desaturated and deliberately slower. */
export function ResultScreen({
  outcome, seed, stageReached, enemyCount, onRestart, reward, onCollection, onMenu,
}: {
  outcome: 'win' | 'defeat'
  seed: string
  /** 1-based stage where the run ended (only meaningful for defeat). */
  stageReached: number
  enemyCount: number
  onRestart: () => void
  /** Currency/unlock/lifetime-stat payoff for this run's end, from useRunB. Absent
   *  (null/undefined) renders exactly like the pre-reward screen — callers that don't
   *  wire meta-progression yet see no change. */
  reward?: RunReward | null
  /** Opens the collection/hub screen. Omitted callers get no second button (Task 9 wires it). */
  onCollection?: () => void
  /** Returns to the main menu (route '/'). Omitted callers get no menu button — so the
   *  run-end screen is never a dead end when wired. */
  onMenu?: () => void
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

      {reward && (
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 * beat, delay: 0.6 * beat, ease: EASE_CINEMATIC }}
        >
          <Frame variant="panel" className={won ? '' : 'saturate-50'} innerClassName="flex min-w-[300px] flex-col items-center gap-3 px-6 py-4">
            <motion.p
              initial={reduce ? false : { opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={
                won
                  ? { type: 'spring', stiffness: 220, damping: 14, delay: 0.75 * beat }
                  : { duration: 0.6, ease: EASE_CINEMATIC, delay: 0.75 * beat }
              }
              className={`font-display text-2xl font-bold ${won ? 'text-amber-300' : 'text-slate-300/85'}`}
            >
              +{reward.earned} 🍫
            </motion.p>
            <p className="text-[11px] uppercase tracking-widest text-white/40">
              Saldo: <span className="text-white/70">{reward.profile.cioccorane} 🍫</span>
            </p>

            {reward.unlocked.length > 0 && (
              <div className="flex flex-col items-center gap-1.5 border-t border-white/10 pt-3">
                {won ? (
                  <FoilText as="h2" className="font-display text-sm font-bold uppercase tracking-widest">
                    Nuovo sblocco!
                  </FoilText>
                ) : (
                  <h2 className="font-display text-sm font-bold uppercase tracking-widest text-slate-300/80">
                    Nuovo sblocco!
                  </h2>
                )}
                <ul className="flex flex-col items-center gap-0.5">
                  {reward.unlocked.map(u => (
                    <li key={`${u.kind}-${u.id}`} className="text-sm text-white/80">{u.label}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-white/10 pt-3 text-[11px] uppercase tracking-widest text-white/40">
              <span>run #{reward.profile.stats.runsPlayed}</span>
              <span>boss sconfitti {reward.profile.stats.bossesKilled}</span>
              <span>miglior area {reward.profile.stats.bestStageReached}</span>
            </div>
          </Frame>
        </motion.div>
      )}

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 * beat, delay: (reward ? 0.85 : 0.65) * beat, ease: EASE_CINEMATIC }}
        className="flex items-center gap-3"
      >
        <Button onClick={onRestart}>Nuova run</Button>
        {onCollection && (
          <Button variant="ghost" onClick={onCollection}>Collezione</Button>
        )}
        {onMenu && (
          <Button variant="ghost" onClick={onMenu}>Menu principale</Button>
        )}
      </motion.div>
    </main>
  )
}
