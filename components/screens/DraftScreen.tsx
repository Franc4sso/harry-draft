'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DraftedWizard } from '@/types'
import { useDraft } from '@/hooks/useDraft'
import { STARTER_PICKS } from '@/game/engine/runEngine'
import { SquadPanel } from '@/components/draft/SquadPanel'
import { DuoTracker } from '@/components/draft/DuoTracker'
import { WizardCard } from '@/components/cards/WizardCard'
import { Stagger, StaggerItem } from '@/components/ui/motion'
import { Insegna } from '@/components/ui/Insegna'

/** Fixed-offer draft: a single non-regenerating screen over a pre-built curated
 *  list (tutorial mode's `tutorialStarterOffer`) instead of the RNG-driven,
 *  multi-screen `draftSession`. Picking removes the chosen candidate from view;
 *  the rest stay put (no reroll) — the trio occupying the offer's first three
 *  slots (see `game/engine/tutorialOffer.ts`) are therefore always `draft-pick-0..2`
 *  on first paint, matching the tutorial's coach-mark anchors. */
function useFixedDraft(offer: DraftedWizard[]): {
  current: DraftedWizard[]
  picks: DraftedWizard[]
  pick: (candidateIndex: number) => void
} {
  // picks + remaining live in one state object so `pick` is a SINGLE pure updater.
  // Splitting them and calling setPicks inside the setRemaining updater made the
  // updater impure: React StrictMode (on by default in `next dev`) double-invokes
  // updaters, so the chosen wizard got appended to picks twice — the tutorial team
  // came out with a duplicated wizard (and "same key" errors in battle).
  const [state, setState] = useState<{ picks: DraftedWizard[]; remaining: DraftedWizard[] }>(
    () => ({ picks: [], remaining: offer }),
  )

  const pick = useCallback((candidateIndex: number) => {
    setState((s) => {
      const chosen = s.remaining[candidateIndex]
      if (!chosen) return s
      return {
        picks: [...s.picks, chosen],
        remaining: s.remaining.filter((_, i) => i !== candidateIndex),
      }
    })
  }, [])

  return { current: state.remaining, picks: state.picks, pick }
}

export function DraftScreen({
  seed, target = STARTER_PICKS, onComplete, fixedOffer,
}: {
  seed: string
  target?: number
  onComplete: (team: DraftedWizard[]) => void
  /** Tutorial mode's curated offer — when set, replaces the normal seeded
   *  multi-screen draft with a single fixed screen over this exact list. */
  fixedOffer?: DraftedWizard[]
}) {
  // Rules-of-hooks: both drafting strategies are always driven (never conditional),
  // and `fixedOffer` is a per-mount constant (RunBRunner never toggles tutorial mode
  // on a live instance) — the branch below just picks which result to use.
  const normalDraft = useDraft(seed, target) // eslint-disable-line react-hooks/rules-of-hooks
  const fixedDraft = useFixedDraft(fixedOffer ?? []) // eslint-disable-line react-hooks/rules-of-hooks
  const { current, picks, pick } = fixedOffer !== undefined ? fixedDraft : normalDraft
  const [considered, setConsidered] = useState<DraftedWizard | null>(null)
  const fired = useRef(false)
  // The shared draft session "completes" only after the full team size; this
  // starter draft ends earlier, after `target` picks.
  const done = picks.length >= target

  useEffect(() => {
    if (done && !fired.current) { fired.current = true; onComplete(picks) }
  }, [done, picks, onComplete])

  if (done) return <main className="flex-1" />

  return (
    // `flex-col` + `min-h-0`: la griglia sotto prende l'altezza RESIDUA invece di
    // fermarsi al contenuto. Senza, con la carta nuova (433px invece di 592) sotto
    // le carte restavano ~270px di fascia nera vuota.
    <main data-testid="draft-screen" className="flex w-full flex-1 flex-col">
      {/* Sticky header: ONE row — title (with the pick count folded into its kicker) +
          the squad rail alongside it — instead of the old 3-line stack (kicker line,
          title, a redundant duplicate "Pesca N/3" line, squad panel below): that stack
          measured 147px, this row ~50px, freeing space for taller card portraits. */}
      {/* z-[60] keeps the sticky header above card chip tooltips (z-50) — without it,
          a tooltip on a top-row wizard paints over the header. */}
      <header className="sticky top-0 z-[60] flex items-center justify-between gap-4 border-b border-white/10 bg-[rgba(10,8,19,0.9)] px-4 py-2 backdrop-blur">
        <Insegna kicker={`Pesca ${picks.length + 1} / ${target}`} title="Scegli il mago" className="text-left [&_h1]:mt-0 [&_h1]:text-xl [&_.kicker]:mb-0 [&_.kicker]:text-[9px] [&_.kicker]:tracking-[0.3em] [&_[aria-hidden]]:hidden sm:[&_h1]:text-2xl" />
        <SquadPanel picks={picks} teamSize={target} layout="row" />
      </header>

      {/*
        Layout A (Pesca): three full cards + the combo panel as a FOURTH column, all in
        one row, aligned top and bottom — not a candidate grid beside a separate right
        rail. Single-column stack on mobile (candidates first, combo below).
      */}
      <div
        className="mx-auto grid min-h-0 w-full max-w-[1340px] flex-1 grid-cols-1 items-stretch gap-4 px-4 py-4 md:grid-cols-[repeat(3,1fr)_402px]"
        onPointerLeave={() => setConsidered(null)}
      >
        {/* Re-key by pick count so each new hand cascades in again. */}
        <Stagger key={picks.length} className="contents">
          {current.map((c, i) => (
            <StaggerItem key={c.wizard.id} className="h-full">
              <div className="h-full" onPointerEnter={() => setConsidered(c)} onFocus={() => setConsidered(c)}>
                <WizardCard
                  drafted={c}
                  density="full"
                  portraitHeight="fill"
                  className="h-full w-full"
                  testId={`draft-pick-${i}`}
                  onClick={() => { setConsidered(null); pick(i) }}
                />
              </div>
            </StaggerItem>
          ))}
        </Stagger>

        {/* Combo panel: fourth column, top- and bottom-aligned with the cards
            (items-start on the grid + h-full here) instead of a sticky right rail. */}
        {/* Combo panel: fourth column, top- and bottom-aligned with the cards.
            Bordo sottile e lastra scura come la carta nuova: la cornice dorata con
            pergamena (Frame + Parchment) apparteneva al vecchio linguaggio, quello
            che l'utente ha chiesto di rendere sobrio — lasciarla qui avrebbe fatto
            gridare il pannello accanto a tre carte volutamente quiete. */}
        <div className="h-full overflow-y-auto rounded-[15px] border border-white/10 bg-[#0c0a17] p-3 [scrollbar-gutter:stable]">
          {/* UN SOLO pannello (piano "Un solo asse", Fase 2): i segnali col loro grado
              — l'ex tracker delle Costellazioni — e le combo che accendono. */}
          <DuoTracker picks={picks} considered={considered} />
        </div>
      </div>

      <p className="py-3 text-center text-[10px] uppercase tracking-widest text-white/30">seed: {seed}</p>
    </main>
  )
}
