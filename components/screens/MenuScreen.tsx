'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, useReducedMotion } from 'framer-motion'
import { SealButton } from '@/components/ui/SealButton'
import { loadRun, clearRun } from '@/lib/runStore'

// A defined Hogwarts-at-night skyline. Kept as one path so the silhouette + its
// warm rim light share the exact same mask.
const SKYLINE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 400' preserveAspectRatio='xMidYMax meet'%3E%3Cpath fill='%23000' d='M0 400 V250 h90 v-30 h40 v30 h40 v-90 l16-26 l16 26 v90 h50 v-150 h14 l14-22 l14 22 h14 v150 h70 v-60 h50 v60 h60 v-190 l22-30 l22 30 v190 h60 v-60 h50 v60 h60 v-150 h14 l14-22 l14 22 h14 v150 h70 v-90 l16-26 l16 26 v90 h40 v-30 h40 v30 h90 V400 Z'/%3E%3C/svg%3E\")"

// Lit tower windows: a handful of tower columns, each a vertical stack. Deterministic
// (no Math.random) so SSR and the client render identically.
const TOWERS = [12, 17, 29, 35, 47, 53, 64, 71, 83, 88]
const WINDOWS = TOWERS.flatMap((tx, ti) =>
  Array.from({ length: 3 + (ti % 4) }, (_, r) => ({
    left: tx + ((r % 2) - 0.5),
    bottom: 6 + r * 5,
    opacity: 0.45 + ((ti * 3 + r) % 5) * 0.1,
    key: `${tx}-${r}`,
  })),
)
// Rising embers — deterministic offsets/durations.
const EMBERS = Array.from({ length: 20 }, (_, i) => ({
  left: (i * 4.7 + 3) % 100,
  dur: 6 + (i % 6) * 1.4,
  delay: -((i * 1.7) % 10),
  key: i,
}))

export function MenuScreen() {
  const router = useRouter()
  const reduce = useReducedMotion()
  const [hasSavedRun, setHasSavedRun] = useState(false)

  useEffect(() => {
    setHasSavedRun(loadRun() !== null)
  }, [])

  const play = () => {
    clearRun()
    router.push('/play')
  }
  const continua = () => router.push('/play')

  return (
    <main className="relative flex-1 flex flex-col items-center justify-center gap-7 overflow-hidden p-8 text-center">
      {/* ── Atmospheric scene ─────────────────────────────────────────── */}
      {/* z-0 (not -z-10): the scene must sit ABOVE the page/GameShell background
          but BELOW the z-10 title/CTA. A negative z here drops it behind the body. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        {/* starfield */}
        <div
          className="absolute inset-0 opacity-50"
          style={{
            backgroundImage:
              'radial-gradient(1px 1px at 20% 28%,#fff,transparent),radial-gradient(1px 1px at 70% 18%,#fff,transparent),radial-gradient(1px 1px at 40% 58%,#cbd,transparent),radial-gradient(1px 1px at 85% 48%,#fff,transparent),radial-gradient(1px 1px at 55% 78%,#fff,transparent),radial-gradient(1px 1px at 10% 72%,#dde,transparent),radial-gradient(1px 1px at 92% 76%,#fff,transparent)',
          }}
        />
        {/* beacon glow behind the title */}
        <div
          className="absolute left-1/2 top-[26%] h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2"
          style={{ background: 'radial-gradient(circle, rgba(217,182,95,0.20), transparent 62%)' }}
        />
        {/* slowly rotating rune ring */}
        <motion.svg
          className="absolute left-1/2 top-[26%] h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 opacity-[0.12]"
          viewBox="0 0 200 200"
          animate={reduce ? undefined : { rotate: 360 }}
          transition={{ duration: 90, repeat: Infinity, ease: 'linear' }}
        >
          <circle cx="100" cy="100" r="96" fill="none" stroke="#d9b65f" strokeWidth="0.5" />
          <circle cx="100" cy="100" r="78" fill="none" stroke="#d9b65f" strokeWidth="0.3" strokeDasharray="2 4" />
        </motion.svg>
        {/* castle silhouette */}
        <div
          className="absolute bottom-0 left-1/2 h-[46vh] w-[140%] -translate-x-1/2"
          style={{ background: 'linear-gradient(180deg,#12102a,#0a0818 55%,#060410)', WebkitMaskImage: SKYLINE, maskImage: SKYLINE, WebkitMaskPosition: 'bottom', maskPosition: 'bottom', WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat', WebkitMaskSize: 'contain', maskSize: 'contain' }}
        />
        {/* warm rim light on the castle */}
        <div
          className="absolute bottom-0 left-1/2 h-[46vh] w-[140%] -translate-x-1/2 mix-blend-screen"
          style={{ background: 'linear-gradient(180deg,rgba(217,182,95,0.14),transparent 30%)', WebkitMaskImage: SKYLINE, maskImage: SKYLINE, WebkitMaskPosition: 'bottom', maskPosition: 'bottom', WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat', WebkitMaskSize: 'contain', maskSize: 'contain' }}
        />
        {/* lit windows */}
        <div className="absolute inset-x-0 bottom-0 h-[46vh] opacity-90">
          {WINDOWS.map((w) => (
            <span
              key={w.key}
              className="absolute h-[5px] w-[3px] rounded-[1px]"
              style={{ left: `${w.left}%`, bottom: `${w.bottom}%`, opacity: w.opacity, background: '#ffcf6a', boxShadow: '0 0 5px #ffb84a, 0 0 10px rgba(255,180,74,0.5)' }}
            />
          ))}
        </div>
        {/* rising embers */}
        {!reduce && EMBERS.map((e) => (
          <motion.span
            key={e.key}
            className="absolute bottom-[-10px] h-[3px] w-[3px] rounded-full"
            style={{ left: `${e.left}%`, background: '#f6ce7a', boxShadow: '0 0 6px #f0b64a' }}
            initial={{ y: 0, opacity: 0 }}
            animate={{ y: '-72vh', opacity: [0, 0.8, 0] }}
            transition={{ duration: e.dur, delay: e.delay, repeat: Infinity, ease: 'linear' }}
          />
        ))}
      </div>

      {/* ── Title ─────────────────────────────────────────────────────── */}
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="relative z-10 space-y-3"
      >
        <p className="kicker">Roguelite di maghi</p>
        <h1 className="font-display text-7xl font-extrabold tracking-wide sm:text-8xl lg:text-9xl" aria-label="Harry Draft">
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
          Pesca la tua squadra di maghi, attraversa tre aree e affronta il Boss Finale.
        </p>
      </motion.div>

      {/* ── Call to action ────────────────────────────────────────────── */}
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3, ease: 'easeOut' }}
        className="relative z-10 flex flex-col items-center gap-4"
      >
        <div className="relative flex flex-col items-center gap-3">
          {!reduce && (
            <motion.span
              aria-hidden
              className="absolute inset-0 -z-10 rounded-full blur-2xl"
              style={{ background: 'radial-gradient(circle, rgba(217,182,95,0.5), transparent 70%)' }}
              animate={{ opacity: [0.5, 0.85, 0.5], scale: [0.94, 1.08, 0.94] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
          <SealButton onClick={play} data-testid="play-cta" className="px-16 py-5 text-lg">
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

        <div className="mt-1 flex items-center gap-5">
          <Link href="/rules" className="font-display text-xs uppercase tracking-wider text-white/45 transition-colors hover:text-gold">Compendio</Link>
          <span aria-hidden className="text-white/15">✦</span>
          <Link href="/collection" className="font-display text-xs uppercase tracking-wider text-white/45 transition-colors hover:text-gold">Collezione</Link>
          <span aria-hidden className="text-white/15">✦</span>
          <Link href="/credits" className="font-display text-xs uppercase tracking-wider text-white/45 transition-colors hover:text-gold">Credits</Link>
        </div>
      </motion.div>
    </main>
  )
}
