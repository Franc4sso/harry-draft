'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { DraftedWizard } from '@/types'
import { useDraft } from '@/hooks/useDraft'
import { STARTER_PICKS } from '@/game/engine/runEngine'
import { SquadPanel } from '@/components/draft/SquadPanel'
import { SynergyTracker } from '@/components/draft/SynergyTracker'
import { DraftCandidateCard } from '@/components/draft/DraftCandidateCard'
import { Stagger, StaggerItem } from '@/components/ui/motion'
import { synergyProgress, previewSynergies } from '@/game/engine/synergy'
import { displayName } from '@/lib/displayName'

export function DraftScreen({
  seed, target = STARTER_PICKS, onComplete,
}: {
  seed: string
  target?: number
  onComplete: (team: DraftedWizard[]) => void
}) {
  const { current, picks, pick } = useDraft(seed)
  const [considered, setConsidered] = useState<DraftedWizard | null>(null)
  const fired = useRef(false)
  // The shared draft session "completes" only after the full team size; this
  // starter draft ends earlier, after `target` picks.
  const done = picks.length >= target

  useEffect(() => {
    if (done && !fired.current) { fired.current = true; onComplete(picks) }
  }, [done, picks, onComplete])

  // tracker rows: preview when a candidate is considered, else current state
  const current_rows = synergyProgress(picks)
  const activeSynergies = current_rows.filter((s) => s.active).length
  const rows = considered ? previewSynergies(picks, considered) : current_rows
  // Memoize the per-candidate "hot synergy" sets so they keep a stable identity
  // across re-renders (e.g. when `considered` changes on hover). Recomputing a new
  // Set for every candidate on every render was a source of hover churn.
  const hotByCandidate = useMemo(() => {
    const m = new Map<string, ReadonlySet<string>>()
    for (const c of current) {
      m.set(c.wizard.id, new Set(previewSynergies(picks, c).filter((p) => p.advances).map((p) => p.synergy.id)))
    }
    return m
  }, [current, picks])

  if (done) return <main className="flex-1" />

  return (
    <main data-testid="draft-screen" className="flex-1 w-full">
      {/* Sticky header: squad + progress */}
      {/* z-[60] keeps the sticky header above card chip tooltips (z-50) — without it,
          a tooltip on a top-row wizard paints over the header. */}
      <header className="sticky top-0 z-[60] border-b border-white/10 bg-[rgba(10,8,19,0.9)] px-4 py-3 backdrop-blur">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h1 className="font-display text-xl">Scegli il {picks.length + 1}º mago</h1>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest">
            <span
              className="rounded-full border px-2 py-0.5 font-semibold"
              style={{
                color: activeSynergies > 0 ? '#7cdc7c' : 'rgba(255,255,255,0.45)',
                borderColor: activeSynergies > 0 ? 'rgba(124,220,124,0.5)' : 'rgba(255,255,255,0.15)',
                background: activeSynergies > 0 ? 'rgba(124,220,124,0.12)' : 'transparent',
              }}
            >
              ⚡ {activeSynergies} sinergie attive
            </span>
            <span className="text-[#b08d57]">Pesca {picks.length}/{target}</span>
          </div>
        </div>
        <SquadPanel picks={picks} teamSize={target} layout="row" />
      </header>

      {/*
        Single-column on mobile: candidates first, tracker below.
        Two-column on desktop (md+): candidates left, tracker right rail.
      */}
      <div className="mx-auto grid max-w-5xl grid-cols-1 items-start gap-6 p-4 md:grid-cols-[1fr_280px]">
        {/* items-start (above) + content-start (here) keep each candidate at its
            own height: without them the column stretches to match the synergy
            rail, growing the hovered card downward when the rail gets taller. */}
        <section onPointerLeave={() => setConsidered(null)}>
          {/* Re-key by pick count so each new hand cascades in again. */}
          <Stagger key={picks.length} className="grid grid-cols-1 content-start gap-4">
            {current.map((c, i) => (
              <StaggerItem key={c.wizard.id}>
                <DraftCandidateCard
                  drafted={c}
                  testId={`draft-pick-${i}`}
                  hotSynergyIds={hotByCandidate.get(c.wizard.id)}
                  onConsider={() => setConsidered(c)}
                  onPick={() => { setConsidered(null); pick(i) }}
                />
              </StaggerItem>
            ))}
          </Stagger>
        </section>

        {/* Synergy tracker: right rail on desktop, stacks below candidates on mobile */}
        <aside>
          <div className="panel-premium sticky top-28 p-3">
            <SynergyTracker rows={rows} candidateName={considered ? displayName(considered) : undefined} />
          </div>
        </aside>
      </div>

      <p className="py-3 text-center text-[10px] uppercase tracking-widest text-white/30">seed: {seed}</p>
    </main>
  )
}
