'use client'
import { useState } from 'react'
import type { DraftedWizard, House } from '@/types'
import { Stagger, StaggerItem } from '@/components/ui/motion'
import { Insegna } from '@/components/ui/Insegna'
import { HouseCrest } from '@/components/ui/HouseCrest'
import { DraftCandidateCard } from '@/components/draft/DraftCandidateCard'
import { STARTER_PICKS } from '@/game/engine/runEngine'
import { useEndless } from '@/hooks/useEndless'
import { RunBRunner } from './RunBRunner'
import { EndlessResult } from './EndlessResult'

const HOUSES: House[] = ['Grifondoro', 'Serpeverde', 'Corvonero', 'Tassorosso']

/** Endless's draft/house-pick phase. NOT DraftScreen: the recorded/replayed challenge-
 *  code contract (game/engine/endlessReplay.ts, built in Task 3/5) is hardcoded to the
 *  house-offer flow (starterOffer/chooseStarters) — the anti-cheat re-simulator replays
 *  `chooseStarters(startRunB(seed), house, starterIds, rng)`, not confirmDraftPicks.
 *  DraftScreen's free 2-of-N picker (which RunBRunner's 'draft' view uses for campaign)
 *  is a different, unreplayed flow, so endless gets its own small picker here instead of
 *  reusing that view. See useEndless.ts's starterOffer/chooseStarters + the parity test
 *  in tests/hooks/useEndless.test.tsx for the exact contract this mirrors. */
function EndlessStarterPick({
  starterOffer, chooseStarters,
}: {
  starterOffer: (house: House) => DraftedWizard[]
  chooseStarters: (house: House, starterIds: string[]) => void
}) {
  const [house, setHouse] = useState<House | null>(null)
  const [picked, setPicked] = useState<DraftedWizard[]>([])

  if (!house) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center gap-8 p-8 text-center">
        <Insegna kicker="Modalità infinita" title="Scegli la tua casa" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {HOUSES.map(h => (
            <button
              key={h}
              type="button"
              data-testid={`endless-house-${h}`}
              onClick={() => setHouse(h)}
              className="flex flex-col items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-6 py-5 transition-colors hover:border-gold/40 hover:bg-white/[0.08] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f3e6a0]"
            >
              <HouseCrest house={h} size={32} />
              <span className="font-display text-sm uppercase tracking-wider text-white/80">{h}</span>
            </button>
          ))}
        </div>
      </main>
    )
  }

  const offer = starterOffer(house)
  const remaining = offer.filter(d => !picked.some(p => p.wizard.id === d.wizard.id))

  const pick = (d: DraftedWizard) => {
    const next = [...picked, d]
    setPicked(next)
    if (next.length >= STARTER_PICKS) chooseStarters(house, next.map(w => w.wizard.id))
  }

  return (
    <main data-testid="endless-starter-pick" className="flex-1 w-full">
      <header className="sticky top-0 z-[60] border-b border-white/10 bg-[rgba(10,8,19,0.9)] px-4 py-2 backdrop-blur">
        <Insegna kicker={`Pesca ${picked.length + 1} / ${STARTER_PICKS}`} title="Scegli il mago" className="[&_h1]:text-xl [&_.kicker]:text-[9px] [&_.kicker]:tracking-[0.3em] sm:[&_h1]:text-2xl" />
      </header>
      <div className="mx-auto max-w-6xl p-4">
        <Stagger key={picked.length} className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-3">
          {remaining.map((d, i) => (
            <StaggerItem key={d.wizard.id} className="h-full">
              <DraftCandidateCard drafted={d} testId={`endless-pick-${i}`} onPick={() => pick(d)} />
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </main>
  )
}

/** Endless-mode run screen. Reuses RunBRunner (and every node/battle/map view it
 *  drives) via the shared controller shape (components/screens/RunBRunner.tsx's
 *  RunnerController) — zero view rebuild for map/battle/recruit/relic/event/
 *  spellForge/infirmary/area-cleared. Two things RunBRunner intentionally does NOT
 *  cover for endless: the initial house/starter pick (own screen above — see its doc
 *  comment for why) and the terminal wipeout screen (EndlessResult below, rendered
 *  OUTSIDE RunBRunner once a score exists, instead of campaign's ResultScreen). */
export function EndlessRunner({ seed }: { seed: string }) {
  const c = useEndless(seed)

  if (c.score !== null) {
    return <EndlessResult score={c.score} floor={c.floor} challengeCode={c.getChallengeCode()} />
  }

  if (c.run.phase === 'draft') {
    return <EndlessStarterPick starterOffer={c.starterOffer} chooseStarters={c.chooseStarters} />
  }

  return <RunBRunner seed={seed} controller={c} />
}
