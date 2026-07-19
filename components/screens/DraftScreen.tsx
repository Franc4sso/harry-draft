'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DraftedWizard } from '@/types'
import { useDraft } from '@/hooks/useDraft'
import { STARTER_PICKS } from '@/game/engine/runEngine'
import { SquadPanel } from '@/components/draft/SquadPanel'
import { DuoTracker } from '@/components/draft/DuoTracker'
import { ArchetypeTracker } from '@/components/draft/ArchetypeTracker'
import { DraftCandidateCard } from '@/components/draft/DraftCandidateCard'
import { Stagger, StaggerItem } from '@/components/ui/motion'
import { Insegna } from '@/components/ui/Insegna'
import { Frame } from '@/components/ui/Frame'
import { Parchment } from '@/components/ui/Parchment'

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
    <main data-testid="draft-screen" className="flex-1 w-full">
      {/* Sticky header: squad + progress */}
      {/* z-[60] keeps the sticky header above card chip tooltips (z-50) — without it,
          a tooltip on a top-row wizard paints over the header. */}
      <header className="sticky top-0 z-[60] border-b border-white/10 bg-[rgba(10,8,19,0.9)] px-4 py-2 backdrop-blur">
        <Insegna kicker={`Pesca ${picks.length + 1} / ${target}`} title="Scegli il mago" className="[&_h1]:text-xl [&_.kicker]:text-[9px] [&_.kicker]:tracking-[0.3em] sm:[&_h1]:text-2xl" />
        <div className="mb-2 mt-1 flex items-center justify-center gap-2 text-[11px] uppercase tracking-widest">
          <span className="text-[#b08d57]">Pesca {picks.length}/{target}</span>
        </div>
        <SquadPanel picks={picks} teamSize={target} layout="row" />
      </header>

      {/*
        Single-column on mobile: candidates first, tracker below.
        Two-column on desktop (md+): candidates left, tracker right rail.
      */}
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-start gap-6 p-4 md:grid-cols-[1fr_320px]">
        {/* items-start (above) + content-start (here) keep each candidate at its
            own height: without them the column stretches to match the tracker
            rail, growing the hovered card downward when the rail gets taller. */}
        <section onPointerLeave={() => setConsidered(null)}>
          {/* Re-key by pick count so each new hand cascades in again. */}
          <Stagger key={picks.length} className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-3">
            {current.map((c, i) => (
              <StaggerItem key={c.wizard.id} className="h-full">
                <DraftCandidateCard
                  drafted={c}
                  testId={`draft-pick-${i}`}
                  onConsider={() => setConsidered(c)}
                  onPick={() => { setConsidered(null); pick(i) }}
                />
              </StaggerItem>
            ))}
          </Stagger>
        </section>

        {/* Combo tracker: right rail on desktop, stacks below candidates on mobile */}
        <aside>
          <Frame variant="panel" className="sticky top-28 max-h-[calc(100dvh-8rem)] overflow-y-auto [scrollbar-gutter:stable]" innerClassName="relative p-3">
            <Parchment className="absolute inset-0" />
            <div className="relative">
              <DuoTracker picks={picks} considered={considered} />
              <ArchetypeTracker picks={picks} considered={considered} className="mt-4" />
            </div>
          </Frame>
        </aside>
      </div>

      <p className="py-3 text-center text-[10px] uppercase tracking-widest text-white/30">seed: {seed}</p>
    </main>
  )
}
