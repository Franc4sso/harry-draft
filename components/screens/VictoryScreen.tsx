'use client'
import { motion } from 'framer-motion'
import { Trophy, Crown } from 'lucide-react'
import type { BattleResult } from '@/types'
import { GlowPanel } from '@/components/ui/GlowPanel'
import { Button } from '@/components/ui/Button'

/** Between-battle interstitial after the player wins a regular stage. */
export function VictoryScreen({
  result, mvpName, battleNumber, enemyCount, bossNext, onNext,
}: {
  result: BattleResult
  mvpName: string
  battleNumber: number
  enemyCount: number
  bossNext: boolean
  onNext: () => void
}) {
  const survivors = result.finalSnapshot.filter(s => s.alive).length
  return (
    <main className="flex-1 flex flex-col items-center justify-center gap-8 p-8">
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 18 }}
        className="flex flex-col items-center gap-2"
      >
        <Trophy size={48} className="text-amber-300" />
        <h1 className="font-display text-4xl">Vittoria!</h1>
        <p className="text-white/50 text-sm">
          Sfida {battleNumber} di {enemyCount} superata
        </p>
      </motion.div>

      <GlowPanel className="p-5 w-full max-w-sm flex flex-col gap-3">
        <div className="flex items-center gap-2 text-amber-200">
          <Crown size={18} />
          <span className="text-sm">
            MVP: <span className="font-display">{mvpName}</span>
          </span>
        </div>
        <div className="flex justify-between text-sm text-white/70">
          <span>Turni</span><span className="tabular-nums">{result.turns}</span>
        </div>
        <div className="flex justify-between text-sm text-white/70">
          <span>Maghi superstiti</span><span className="tabular-nums">{survivors}</span>
        </div>
      </GlowPanel>

      <Button onClick={onNext}>
        {bossNext ? 'Affronta il Boss' : 'Prossima sfida'}
      </Button>
    </main>
  )
}
