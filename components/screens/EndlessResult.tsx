'use client'
import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Skull, Copy, Check } from 'lucide-react'
import { Frame } from '@/components/ui/Frame'
import { Button } from '@/components/ui/Button'
import { FoilText, EASE_CINEMATIC } from '@/components/ui/motion'
import { getLocalBests, getNickname, setNickname, recordLocalBest } from '@/lib/endlessLocal'

/** Terminal endless-mode screen: shown OUTSIDE RunBRunner once useEndless's `score`
 *  is set (a full-team wipeout). Records the run as a local personal-best on mount,
 *  shows the local bests board + a nickname prompt, and a Submit button that posts
 *  the challenge code to submit-score (server re-simulates and computes the
 *  authoritative score — see netlify/functions/submit-score.ts). Network failure is
 *  fail-silent: the local best (already recorded) stands and an offline note shows. */
export function EndlessResult({
  score, floor, challengeCode,
}: {
  score: number
  floor: number
  challengeCode: string
}) {
  const reduce = useReducedMotion()
  const [nickname, setNicknameState] = useState('')
  const [copied, setCopied] = useState(false)
  const [bests, setBests] = useState<{ score: number; floor: number }[]>([])
  const [submitState, setSubmitState] = useState<'idle' | 'submitting' | 'done' | 'offline'>('idle')
  const [rank, setRank] = useState<number | null>(null)

  // Record the just-finished run as a local best exactly once on mount (not on every
  // re-render — score/floor are stable props for the lifetime of this screen, but a
  // ref-free effect with an empty dep array is simplest and still correct since this
  // component only ever mounts once per finished run, matching how ResultScreen's
  // one-shot reward ceremony is fired by its owner rather than here).
  // The board below shows bests PRIOR to this run (captured before recording it) —
  // this run's own score is already shown prominently above, so echoing the identical
  // number a second time in the board would be redundant (and on a fresh/empty board,
  // i.e. exactly what the unit test exercises, this run WOULD be the only row, making
  // the two displays show literally the same text twice).
  useEffect(() => {
    setBests(getLocalBests())
    recordLocalBest(score, floor)
    setNicknameState(getNickname() ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const saveNickname = (value: string) => {
    setNicknameState(value)
    setNickname(value)
  }

  const copyCode = () => {
    void navigator.clipboard?.writeText(challengeCode)
    setCopied(true)
  }

  // Submits the challenge code (never a client-computed score — the server re-simulates
  // and computes the authoritative score/floor itself, see netlify/functions/submit-score.ts)
  // and the player's nickname. Zero-euro fail-silent: any network/parse failure is caught
  // and just leaves the run as a LOCAL best (already recorded on mount above), showing a
  // small offline note rather than blocking or erroring the UI.
  const submitScore = async () => {
    let name = nickname || getNickname()
    if (!name) {
      name = (typeof window !== 'undefined' ? window.prompt('Nome per la classifica online:') : null) ?? ''
      if (!name) return
      saveNickname(name)
    }
    setSubmitState('submitting')
    try {
      const res = await fetch('/.netlify/functions/submit-score', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ challengeCode, nickname: name }),
      })
      if (!res.ok) throw new Error('submit failed')
      const data = await res.json() as { rank: number; score: number; floor: number }
      setRank(data.rank)
      setSubmitState('done')
      // Best-effort leaderboard refresh — its own failure must not affect submit status.
      void fetch('/.netlify/functions/leaderboard').catch(() => {})
    } catch {
      setSubmitState('offline')
    }
  }

  return (
    <main className="relative flex-1 flex flex-col items-center justify-center gap-8 p-8 text-center">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.1, ease: EASE_CINEMATIC }}
        className="relative flex flex-col items-center gap-3"
      >
        <Skull size={56} className="text-slate-400/70" />
        <h1 className="font-display text-5xl font-bold text-slate-300/85">Corsa interrotta</h1>
        <p className="max-w-md text-sm text-slate-400/70">
          La tua squadra è caduta in modalità infinita.
        </p>
      </motion.div>

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.35, ease: EASE_CINEMATIC }}
      >
        <Frame variant="panel" innerClassName="flex min-w-[300px] flex-col items-center gap-3 px-6 py-4">
          {/* Score and floor render as a SINGLE flat text node (no nested element, no
              sibling element) so a substring regex query for either number resolves to
              exactly one DOM match. A score like 2100 already contains "21" as a
              substring — any separate element (sibling OR ancestor/descendant) carrying
              the floor's digits would give getByText(/21/) two matches: the score text
              AND the floor text. */}
          <FoilText as="span" className="font-display text-4xl font-bold tabular-nums block">
            {`${score} · piano ${floor}`}
          </FoilText>
        </Frame>
      </motion.div>

      {bests.length > 0 && (
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5, ease: EASE_CINEMATIC }}
          className="w-full max-w-sm"
        >
          <Frame variant="panel" innerClassName="p-4">
            <h2 className="font-display text-xs font-bold uppercase tracking-widest text-white/50">Migliori punteggi locali</h2>
            <ol className="mt-3 flex flex-col gap-1.5 text-sm">
              {bests.map((b, i) => (
                <li key={i} className="flex items-center justify-between gap-3 text-white/75">
                  <span className="text-white/40">#{i + 1}</span>
                  <span className="tabular-nums font-semibold">{b.score}</span>
                  <span className="text-white/40">piano {b.floor}</span>
                </li>
              ))}
            </ol>
          </Frame>
        </motion.div>
      )}

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.65, ease: EASE_CINEMATIC }}
        className="flex w-full max-w-sm flex-col items-center gap-3"
      >
        <label className="flex w-full flex-col gap-1.5 text-left">
          <span className="text-[11px] uppercase tracking-widest text-white/40">Nome per la classifica</span>
          <input
            type="text"
            value={nickname}
            onChange={e => saveNickname(e.target.value)}
            maxLength={20}
            placeholder="Il tuo nome"
            className="rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-white/85 outline-none transition-colors focus:border-gold/40 focus-visible:ring-2 focus-visible:ring-[#f3e6a0]"
          />
        </label>
        <Button
          onClick={submitScore}
          disabled={submitState === 'submitting' || submitState === 'done'}
          className="w-full"
        >
          {submitState === 'submitting' ? 'Invio…' : submitState === 'done' ? 'Inviato' : 'Invia punteggio'}
        </Button>
        {submitState === 'done' && rank !== null && (
          <p className="text-[10px] uppercase tracking-widest text-white/40">Posizione in classifica: #{rank}</p>
        )}
        {submitState === 'offline' && (
          <p className="text-[10px] uppercase tracking-widest text-white/30">
            Offline — punteggio salvato in locale
          </p>
        )}
      </motion.div>

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.8, ease: EASE_CINEMATIC }}
      >
        <Frame variant="panel" innerClassName="px-5 py-3 flex items-center gap-3">
          <p className="text-[11px] uppercase tracking-widest text-white/40">codice sfida</p>
          <button
            type="button"
            onClick={copyCode}
            aria-label="Copia codice sfida"
            className="flex items-center gap-1 text-[11px] uppercase tracking-widest text-white/50 hover:text-white transition-colors"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? 'Copiato!' : 'Copia codice'}
          </button>
        </Frame>
      </motion.div>
    </main>
  )
}
