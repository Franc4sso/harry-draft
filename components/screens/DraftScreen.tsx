'use client'
import { useEffect, useRef, useState } from 'react'
import type { DraftedWizard } from '@/types'
import { useDraft } from '@/hooks/useDraft'
import { SquadPanel } from '@/components/draft/SquadPanel'
import { SynergyTracker } from '@/components/draft/SynergyTracker'
import { DraftCandidateCard } from '@/components/draft/DraftCandidateCard'
import { synergyProgress, previewSynergies } from '@/game/engine/synergy'

export function DraftScreen({ seed, onComplete }: { seed: string; onComplete: (team: DraftedWizard[]) => void }) {
  const { current, picks, teamSize, done, pick } = useDraft(seed)
  const [considered, setConsidered] = useState<DraftedWizard | null>(null)
  const fired = useRef(false)

  useEffect(() => {
    if (done && !fired.current) { fired.current = true; onComplete(picks) }
  }, [done, picks, onComplete])

  // tracker rows: preview when a candidate is considered, else current state
  const current_rows = synergyProgress(picks)
  const activeSynergies = current_rows.filter((s) => s.active).length
  const rows = considered ? previewSynergies(picks, considered) : current_rows
  const hotByCandidate = (c: DraftedWizard): ReadonlySet<string> =>
    new Set(previewSynergies(picks, c).filter((p) => p.advances).map((p) => p.synergy.id))

  if (done) return <main className="flex-1" />

  return (
    <main className="flex-1 w-full">
      {/* Sticky header: squad + progress */}
      <header className="sticky top-0 z-10 border-b border-white/10 bg-[rgba(10,8,19,0.9)] px-4 py-3 backdrop-blur">
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
            <span className="text-[#b08d57]">Pesca {picks.length}/{teamSize}</span>
          </div>
        </div>
        <SquadPanel picks={picks} teamSize={teamSize} layout="row" />
      </header>

      {/*
        Single-column on mobile: candidates first, tracker below.
        Two-column on desktop (md+): candidates left, tracker right rail.
      */}
      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 p-4 md:grid-cols-[1fr_280px]">
        {/* Candidates: single column on mobile (one under the other), 2-up on
            small screens, 3-up on large. */}
        <section
          className="grid grid-cols-1 justify-items-center gap-5 sm:grid-cols-2 lg:grid-cols-3"
          onPointerLeave={() => setConsidered(null)}
        >
          {current.map((c, i) => (
            <DraftCandidateCard
              key={c.wizard.id}
              drafted={c}
              hotSynergyIds={hotByCandidate(c)}
              onConsider={() => setConsidered(c)}
              onPick={() => { setConsidered(null); pick(i) }}
            />
          ))}
        </section>

        {/* Synergy tracker: right rail on desktop, stacks below candidates on mobile */}
        <aside>
          <div className="sticky top-28 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <SynergyTracker rows={rows} candidateName={considered?.wizard.name} />
          </div>
        </aside>
      </div>

      <p className="py-3 text-center text-[10px] uppercase tracking-widest text-white/30">seed: {seed}</p>
    </main>
  )
}
