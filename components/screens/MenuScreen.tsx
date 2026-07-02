'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, useReducedMotion } from 'framer-motion'
import { TiltCard } from '@/components/ui/motion'
import { SealButton } from '@/components/ui/SealButton'
import { WizardCard } from '@/components/cards/WizardCard'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARD_BY_ID } from '@/data/wizards'
import { loadRun, clearRun } from '@/lib/runStore'

const teaser = draftWizard(createRng(7), WIZARD_BY_ID['harry']!)

export function MenuScreen() {
  const router = useRouter()
  const reduce = useReducedMotion()
  const [hasSavedRun, setHasSavedRun] = useState(false)

  // Guard localStorage access — must run only after mount so SSR is safe.
  useEffect(() => {
    setHasSavedRun(loadRun() !== null)
  }, [])

  const play = () => {
    clearRun()
    router.push('/play')
  }

  const continua = () => {
    // Do NOT clear the run — useRunB will resume from the saved state.
    router.push('/play')
  }

  return (
    <main className="relative flex-1 flex flex-col items-center justify-center gap-9 overflow-hidden p-8 text-center">
      {/* Ambient candlelight — a warm gold pool above, a cold arcane wash below. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div
          className="absolute left-1/2 top-[-12%] h-[42rem] w-[42rem] -translate-x-1/2 rounded-full blur-[120px]"
          style={{ background: 'radial-gradient(circle, rgba(202,162,74,0.16), transparent 60%)' }}
        />
        <div
          className="absolute left-1/2 bottom-[-25%] h-[34rem] w-[44rem] -translate-x-1/2 rounded-full blur-[130px]"
          style={{ background: 'radial-gradient(circle, rgba(140,90,40,0.14), transparent 60%)' }}
        />
      </div>

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="relative space-y-3"
      >
        <p className="kicker">Roguelite di maghi</p>
        <h1
          className="font-display text-7xl font-extrabold tracking-wide sm:text-8xl lg:text-9xl"
          aria-label="Harry Draft"
        >
          {/* Each letter carries the gold gradient itself: background-clip:text does NOT
              propagate through nested spans, so the gradient must live on the clipped
              element that actually holds the glyph (a FoilText wrapper left them invisible). */}
          {'Harry Draft'.split('').map((ch, i) => (
              <motion.span
                key={i}
                aria-hidden
                className="title-gradient inline-block"
                initial={reduce ? false : { opacity: 0, y: 22, filter: 'blur(8px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 0.55, delay: 0.08 + i * 0.045, ease: [0.22, 1, 0.36, 1] }}
              >
                {ch === ' ' ? ' ' : ch}
              </motion.span>
            ))}
        </h1>
        <p className="mx-auto max-w-md text-white/60">
          Componi una squadra di cinque maghi, supera cinque sfidanti e affronta il Boss Finale.
        </p>
      </motion.div>

      {/* Teaser of the draft — a single card, levitating with real weight. */}
      <motion.div
        initial={reduce ? false : { opacity: 0, scale: 0.96 }}
        animate={
          reduce
            ? { opacity: 1, scale: 1 }
            : { opacity: 1, scale: 1, y: [0, -14, 0] }
        }
        transition={
          reduce
            ? { duration: 0.5, delay: 0.15 }
            : { opacity: { duration: 0.5, delay: 0.15 }, scale: { duration: 0.5, delay: 0.15 }, y: { duration: 5, repeat: Infinity, ease: 'easeInOut' } }
        }
        className="relative"
      >
        <TiltCard className="relative" max={8}>
          <WizardCard drafted={teaser} />
        </TiltCard>
      </motion.div>

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.25, ease: 'easeOut' }}
        className="relative flex flex-col items-center gap-4"
      >
        <div className="relative flex flex-col items-center gap-3">
          {/* Summoning aura behind the call to action. */}
          {!reduce && (
            <motion.span
              aria-hidden
              className="absolute inset-0 -z-10 rounded-2xl blur-2xl"
              style={{ background: 'radial-gradient(circle, rgba(202,162,74,0.55), transparent 70%)' }}
              animate={{ opacity: [0.5, 0.85, 0.5], scale: [0.96, 1.08, 0.96] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
          <SealButton onClick={play} data-testid="play-cta" className="px-14 py-5 text-lg">
            Gioca
          </SealButton>

          {hasSavedRun && (
            <button
              type="button"
              onClick={continua}
              className="font-display text-sm uppercase tracking-wider text-gold/80 transition-colors hover:text-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f3e6a0]"
            >
              Continua run
            </button>
          )}
        </div>
        <p className="text-xs text-white/45">Ogni partita, una nuova mano del destino.</p>

        <div className="mt-2 flex items-center gap-5">
          <Link href="/rules" className="font-display text-xs uppercase tracking-wider text-white/45 transition-colors hover:text-gold">Compendio</Link>
          <span aria-hidden className="text-white/15">·</span>
          <Link href="/credits" className="font-display text-xs uppercase tracking-wider text-white/45 transition-colors hover:text-gold">Credits</Link>
        </div>
      </motion.div>
    </main>
  )
}
