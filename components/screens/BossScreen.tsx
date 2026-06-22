'use client'
import { motion } from 'framer-motion'
import { Skull } from 'lucide-react'
import { Button } from '@/components/ui/Button'

/** Dramatic intro shown right before the final boss fight. */
export function BossScreen({ bossName, onBegin }: { bossName: string; onBegin: () => void }) {
  return (
    <main className="flex-1 flex flex-col items-center justify-center gap-8 p-8 text-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="flex flex-col items-center gap-4"
      >
        <motion.div
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut' }}
        >
          <Skull size={64} className="text-rose-500" />
        </motion.div>
        <p className="text-xs uppercase tracking-[0.4em] text-rose-300/70">Boss Finale</p>
        <h1 className="font-display text-5xl text-rose-100 drop-shadow-[0_0_24px_rgba(244,63,94,0.5)]">
          {bossName}
        </h1>
        <p className="max-w-md text-white/50 text-sm">
          L&apos;ultima sfida ti attende. Solo una squadra all&apos;apice delle sue sinergie
          può sperare di prevalere.
        </p>
      </motion.div>
      <Button onClick={onBegin}>Inizia lo scontro</Button>
    </main>
  )
}
