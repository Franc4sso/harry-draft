'use client'
import { motion, useReducedMotion } from 'framer-motion'
import { Skull } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Frame } from '@/components/ui/Frame'
import { FoilText, EASE_CINEMATIC } from '@/components/ui/motion'

/** Dramatic intro shown right before the final boss fight. */
export function BossScreen({ bossName, onBegin }: { bossName: string; onBegin: () => void }) {
  const reduce = useReducedMotion()
  return (
    <main className="relative flex-1 flex flex-col items-center justify-center gap-8 p-8 text-center">
      {/* Menace wash — a red pall bleeding down from above. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <motion.div
          className="absolute left-1/2 top-[-15%] h-[42rem] w-[50rem] -translate-x-1/2 rounded-full blur-[130px]"
          style={{ background: 'radial-gradient(circle, rgba(190,40,60,0.20), transparent 60%)' }}
          animate={reduce ? undefined : { opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <motion.div
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 26, scale: 0.94, filter: 'blur(10px)' }}
        animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
        transition={{ duration: 0.8, ease: EASE_CINEMATIC }}
        className="relative flex flex-col items-center gap-4"
      >
        <motion.div
          animate={reduce ? undefined : { scale: [1, 1.08, 1] }}
          transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut' }}
        >
          <Skull size={64} className="text-rose-500" style={{ filter: 'drop-shadow(0 0 22px rgba(244,63,94,0.6))' }} />
        </motion.div>
        <p className="font-display text-xs font-semibold uppercase tracking-[0.4em] text-rose-300/70">Boss Finale</p>
        <span
          className="drop-shadow-[0_0_24px_rgba(244,63,94,0.55)]"
          style={{ filter: 'hue-rotate(-50deg) saturate(1.6) brightness(1.05)' }}
        >
          <FoilText as="h1" className="font-display text-6xl font-bold">
            {bossName}
          </FoilText>
        </span>
        <div aria-hidden className="h-px w-56" style={{ background: 'linear-gradient(90deg, transparent, rgba(244,63,94,0.6), transparent)' }} />
        <Frame variant="panel" innerClassName="px-5 py-4 max-w-md">
          <p className="text-white/60 text-sm">
            L&apos;ultima sfida ti attende. Solo una squadra all&apos;apice delle sue sinergie
            può sperare di prevalere.
          </p>
        </Frame>
      </motion.div>
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.6, ease: EASE_CINEMATIC }}
      >
        <Button variant="danger" onClick={onBegin}>Inizia lo scontro</Button>
      </motion.div>
    </main>
  )
}
