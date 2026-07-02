'use client'
import { useEffect, useState } from 'react'
import { animate, motion, useReducedMotion } from 'framer-motion'
import { Trophy, Crown } from 'lucide-react'
import type { BattleResult } from '@/types'
import { Frame } from '@/components/ui/Frame'
import { Parchment } from '@/components/ui/Parchment'
import { SealButton } from '@/components/ui/SealButton'
import { FoilText, EASE_CINEMATIC } from '@/components/ui/motion'

/** Number that counts up from 0 on mount (static under reduced motion). */
function CountUp({ value, delay = 0 }: { value: number; delay?: number }) {
  const reduce = useReducedMotion()
  const [shown, setShown] = useState(reduce ? value : 0)
  useEffect(() => {
    if (reduce) return
    const controls = animate(0, value, {
      duration: 0.8,
      delay,
      ease: EASE_CINEMATIC,
      onUpdate: v => setShown(Math.round(v)),
    })
    return () => controls.stop()
  }, [value, delay, reduce])
  return <span className="tabular-nums">{shown}</span>
}

/** One-shot burst of gold sparks radiating from the trophy. */
function GoldBurst() {
  const reduce = useReducedMotion()
  if (reduce) return null
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
      {Array.from({ length: 12 }, (_, i) => {
        const angle = (i / 12) * Math.PI * 2
        const dist = 70 + ((i * 37) % 30)
        return (
          <motion.span
            key={i}
            className="absolute h-1.5 w-1.5 rounded-full"
            style={{ background: i % 3 === 0 ? '#f3e6a0' : '#caa24a', boxShadow: '0 0 8px rgba(202,162,74,0.8)' }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{ x: Math.cos(angle) * dist, y: Math.sin(angle) * dist, opacity: 0, scale: 0.3 }}
            transition={{ duration: 0.9, delay: 0.25, ease: 'easeOut' }}
          />
        )
      })}
    </span>
  )
}

/** Between-battle interstitial after the player wins a regular stage. */
export function VictoryScreen({
  result, mvpName, battleNumber, enemyCount, bossNext, onNext, fallenNames = [],
}: {
  result: BattleResult
  mvpName: string
  battleNumber: number
  enemyCount: number
  bossNext: boolean
  onNext: () => void
  /** Names of player wizards permanently lost this battle. */
  fallenNames?: string[]
}) {
  const reduce = useReducedMotion()
  const survivors = result.finalSnapshot.filter(s => s.alive).length
  return (
    <main className="flex-1 flex flex-col items-center justify-center gap-8 p-8">
      <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-8">
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 220, damping: 18 }}
          className="relative flex flex-col items-center gap-2"
        >
          <GoldBurst />
          <motion.span
            initial={reduce ? false : { rotate: -8, scale: 0.7 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.15 }}
          >
            <Trophy size={48} className="text-amber-300" style={{ filter: 'drop-shadow(0 0 18px rgba(245,196,81,0.55))' }} />
          </motion.span>
          <FoilText as="h1" className="font-display text-4xl font-bold">Vittoria!</FoilText>
          <p className="text-white/50 text-sm">
            Sfida {battleNumber} di {enemyCount} superata
          </p>
        </motion.div>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 18, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.55, delay: 0.35, ease: EASE_CINEMATIC }}
          className="w-full"
        >
          <Frame variant="panel" innerClassName="p-0">
            <Parchment className="flex flex-col gap-3 rounded-[11px] p-5">
              <div className="flex items-center gap-2 text-amber-200">
                <Crown size={18} />
                <span className="text-sm">
                  MVP: <span className="font-display">{mvpName}</span>
                </span>
              </div>
              <div className="flex justify-between text-sm text-white/70">
                <span>Turni</span><CountUp value={result.turns} delay={0.55} />
              </div>
              <div className="flex justify-between text-sm text-white/70">
                <span>Maghi superstiti</span><CountUp value={survivors} delay={0.7} />
              </div>
              {fallenNames.length > 0 && (
                <div className="flex flex-col gap-1 text-sm text-rose-300/90 border-t border-white/10 pt-2">
                  <span className="text-rose-300">Caduti per sempre</span>
                  <span className="text-white/70">{fallenNames.join(', ')}</span>
                </div>
              )}
            </Parchment>
          </Frame>
        </motion.div>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.75, ease: EASE_CINEMATIC }}
        >
          <SealButton onClick={onNext}>
            {bossNext ? 'Affronta il Boss' : 'Prossima sfida'}
          </SealButton>
        </motion.div>
      </div>
    </main>
  )
}
