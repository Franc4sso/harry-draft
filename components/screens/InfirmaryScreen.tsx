'use client'
import { motion, useReducedMotion } from 'framer-motion'
import type { DraftedWizard } from '@/types'
import { Button } from '@/components/ui/Button'
import { Frame } from '@/components/ui/Frame'
import { Parchment } from '@/components/ui/Parchment'
import { Reveal, Stagger, StaggerItem } from '@/components/ui/motion'

export function InfirmaryScreen({
  team,
  onContinue,
}: {
  team: DraftedWizard[]
  onContinue: () => void
}) {
  const reduce = useReducedMotion()
  return (
    <main className="flex-1 w-full flex flex-col items-center justify-center gap-6 p-6 text-center">
      <Reveal>
        <Frame variant="panel" className="max-w-md shadow-[0_0_32px_rgba(52,211,153,0.12)]" innerClassName="relative px-8 py-6 text-center">
          <Parchment className="absolute inset-0" />
          {/* Healing pulse — a soft green heartbeat behind the ward crest. */}
          {!reduce && (
            <motion.span
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{ background: 'radial-gradient(circle at 50% 20%, rgba(52,211,153,0.22), transparent 65%)' }}
              animate={{ opacity: [0.4, 0.9, 0.4] }}
              transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
          <p className="relative mb-3 text-3xl text-emerald-300" aria-hidden>+</p>
          <h1 className="relative font-display text-2xl text-emerald-200">Infermeria</h1>
          <p className="relative mt-2 text-sm leading-relaxed text-white/70">
            L&apos;Infermeria ti rimette in sesto — tutti tornano in piena salute.
          </p>
        </Frame>
      </Reveal>

      <Stagger delay={0.25} className="flex w-full max-w-xs flex-col gap-2">
        {team.map(d => (
          <StaggerItem key={d.wizard.id}>
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm">
              <span className="text-white/80">{d.wizard.name}</span>
              <span className="font-semibold text-emerald-300">{d.maxHp} / {d.maxHp} HP</span>
            </div>
          </StaggerItem>
        ))}
      </Stagger>

      <Button variant="primary" onClick={onContinue}>Continua</Button>
    </main>
  )
}
