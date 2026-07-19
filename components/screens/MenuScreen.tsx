'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, useReducedMotion } from 'framer-motion'
import { loadRun, clearRun } from '@/lib/runStore'
import { loadProfile, saveProfile, markTutorialNudgeSeen } from '@/lib/metaStore'

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

/** One of the two peer game modes on the home screen. A framed doorway — accent-tinted,
 *  its own kicker/title/blurb — so Campagna and Infinita read as equal choices. `primary`
 *  fills the panel (the default run); the other is an outline in its own accent. */
function ModeDoor({
  onClick, testId, accent, icon, kicker, title, blurb, primary = false,
}: {
  onClick: () => void
  testId: string
  accent: string
  icon: string
  kicker: string
  title: string
  blurb: string
  primary?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className="group relative flex h-full flex-col items-center justify-start gap-2.5 rounded-2xl border px-6 pb-6 pt-7 text-center transition-all duration-200 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
      style={{
        borderColor: `${accent}${primary ? 'cc' : '55'}`,
        background: primary
          ? `linear-gradient(180deg, ${accent}30, ${accent}10)`
          : 'rgba(255,255,255,0.03)',
        boxShadow: primary ? `0 0 24px -6px ${accent}66, inset 0 1px 0 ${accent}40` : 'none',
        // @ts-expect-error — CSS custom prop for the focus ring color
        '--tw-ring-color': accent,
      }}
    >
      <span
        aria-hidden
        className="grid h-11 w-11 place-items-center rounded-full border text-xl transition-transform duration-200 group-hover:scale-110"
        style={{ color: accent, borderColor: `${accent}66`, background: `${accent}1a` }}
      >
        {icon}
      </span>
      <span className="font-display text-[10px] uppercase tracking-[0.28em]" style={{ color: accent }}>
        {kicker}
      </span>
      <span
        className="font-display text-2xl font-extrabold leading-none tracking-wide"
        style={{ color: primary ? '#f6ecc4' : '#e8e2f4' }}
      >
        {title}
      </span>
      <span className="max-w-[24ch] text-xs leading-snug text-white/55">{blurb}</span>
    </button>
  )
}

export function MenuScreen() {
  const router = useRouter()
  const reduce = useReducedMotion()
  const [hasSavedRun, setHasSavedRun] = useState(false)
  const [nudge, setNudge] = useState(false)

  useEffect(() => {
    setHasSavedRun(loadRun() !== null)
    setNudge(!(loadProfile().tutorialNudgeSeen))
  }, [])

  const dismissNudge = () => {
    saveProfile(markTutorialNudgeSeen(loadProfile()))
    setNudge(false)
  }

  const play = () => {
    dismissNudge()
    clearRun()
    router.push('/play')
  }
  const continua = () => router.push('/play')
  const tutorial = () => {
    dismissNudge()
    router.push('/play?tutorial=1')
  }

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
          Pesca la tua squadra di maghi. Scegli come affrontare il destino.
        </p>
      </motion.div>

      {/* ── Call to action ────────────────────────────────────────────── */}
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3, ease: 'easeOut' }}
        className="relative z-10 flex flex-col items-center gap-4"
      >
        {hasSavedRun && (
          <button
            type="button"
            onClick={continua}
            data-testid="continue-cta"
            className="font-display text-sm uppercase tracking-wider text-gold transition-colors hover:text-[#f3e6a0] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f3e6a0]"
          >
            ↻ Riprendi la run in corso
          </button>
        )}

        {/* Two peer doorways: Campagna and Infinita are equal choices, not a CTA + afterthought.
            items-stretch keeps both cards the same height regardless of copy length. */}
        <div className="relative grid w-full max-w-xl grid-cols-1 items-stretch gap-4 sm:grid-cols-2">
          {!reduce && (
            <motion.span
              aria-hidden
              className="absolute inset-0 -z-10 rounded-[28px] blur-2xl"
              style={{ background: 'radial-gradient(circle, rgba(217,182,95,0.35), transparent 70%)' }}
              animate={{ opacity: [0.4, 0.7, 0.4], scale: [0.96, 1.05, 0.96] }}
              transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
          <ModeDoor
            onClick={play}
            testId="play-cta"
            accent="#d9b65f"
            icon="⚔"
            kicker="Campagna"
            title="Nuova run"
            blurb="Tre aree, un Boss Finale. La corsa che si può vincere."
            primary
          />
          <ModeDoor
            onClick={() => router.push('/endless')}
            testId="endless-cta"
            accent="#b98cff"
            icon="∞"
            kicker="Senza fine"
            title="Infinita"
            blurb="Ondate senza fine. Quanto lontano arrivi?"
          />
        </div>

        <div className="mt-1 flex items-center gap-5">
          <button
            type="button"
            onClick={tutorial}
            data-testid="tutorial-cta"
            className="relative font-display text-xs uppercase tracking-wider text-white/45 transition-colors hover:text-gold"
          >
            Tutorial
            {nudge && (
              <span data-testid="tutorial-nudge" className="ml-2 rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-bold text-gold">
                ✨ Nuovo? Inizia qui
              </span>
            )}
          </button>
          <span aria-hidden className="text-white/15">✦</span>
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
