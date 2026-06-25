'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, useReducedMotion } from 'framer-motion'
import { WizardCard } from '@/components/cards/WizardCard'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARD_BY_ID } from '@/data/wizards'

const teaser = draftWizard(createRng(7), WIZARD_BY_ID['harry']!)

export function MenuScreen() {
  const router = useRouter()
  const reduce = useReducedMotion()

  // No seed to type: the run is summoned fresh. The /play gate mints a random
  // seed when none is present, so the player never has to copy/paste anything.
  const play = () => router.push('/play')

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
          style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.12), transparent 60%)' }}
        />
      </div>

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="relative space-y-3"
      >
        <p className="font-display text-[11px] uppercase tracking-[0.42em] text-gold/80">
          Roguelite di maghi
        </p>
        <h1
          className="font-display text-6xl font-extrabold tracking-wide sm:text-7xl"
          style={{
            backgroundImage: 'linear-gradient(180deg, #f6ecc4 0%, #d9b65f 48%, #a9802f 100%)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
            filter: 'drop-shadow(0 4px 24px rgba(202,162,74,0.35))',
          }}
        >
          Harry Draft
        </h1>
        <p className="mx-auto max-w-md text-white/60">
          Componi una squadra di cinque maghi, supera cinque sfidanti e affronta il Boss Finale.
        </p>
      </motion.div>

      {/* Teaser of the draft — a single card, breathing gently. */}
      <motion.div
        initial={reduce ? false : { opacity: 0, scale: 0.96 }}
        animate={
          reduce
            ? { opacity: 1, scale: 1 }
            : { opacity: 1, scale: 1, y: [0, -8, 0] }
        }
        transition={
          reduce
            ? { duration: 0.5, delay: 0.15 }
            : { opacity: { duration: 0.5, delay: 0.15 }, scale: { duration: 0.5, delay: 0.15 }, y: { duration: 6, repeat: Infinity, ease: 'easeInOut' } }
        }
        className="relative"
      >
        <WizardCard drafted={teaser} />
      </motion.div>

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.25, ease: 'easeOut' }}
        className="relative flex flex-col items-center gap-4"
      >
        <div className="relative">
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
          <button
            type="button"
            onClick={play}
            className="group relative rounded-2xl px-12 py-4 font-display text-base font-bold uppercase tracking-[0.22em] text-[#1a1206] transition-transform duration-200 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f3e6a0] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            style={{
              backgroundImage: 'linear-gradient(180deg, #f3e0a0 0%, #caa24a 55%, #b0853a 100%)',
              boxShadow: '0 0 0 1px rgba(243,230,160,0.5) inset, 0 10px 30px rgba(176,133,58,0.4)',
            }}
          >
            Gioca
          </button>
        </div>
        <p className="text-xs text-white/45">Ogni partita, una nuova mano del destino.</p>

        <div className="mt-2 flex gap-5">
          <Link href="/rules" className="font-display text-sm uppercase tracking-wider text-white/55 transition-colors hover:text-gold">Compendio</Link>
          <span aria-hidden className="text-white/20">·</span>
          <Link href="/credits" className="font-display text-sm uppercase tracking-wider text-white/55 transition-colors hover:text-gold">Credits</Link>
        </div>
      </motion.div>
    </main>
  )
}
