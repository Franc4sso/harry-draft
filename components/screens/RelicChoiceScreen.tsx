'use client'
import type { ActiveRelic, ActiveSynergy, DraftedWizard, Relic } from '@/types'
import { RelicCard } from '@/components/relics/RelicCard'
import { RelicBar } from '@/components/relics/RelicBar'
import { SquadPanel } from '@/components/draft/SquadPanel'

export function RelicChoiceScreen({
  choices, owned, team, synergies, onChoose,
}: {
  choices: Relic[]
  owned: ActiveRelic[]
  team: DraftedWizard[]
  synergies: ActiveSynergy[]
  onChoose: (relic: Relic) => void
}) {
  return (
    <main className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
      <h1 className="font-display text-4xl">Scegli una reliquia</h1>
      <div className="flex flex-wrap justify-center gap-5">
        {choices.map((relic) => (
          <RelicCard key={relic.id} relic={relic} onClick={() => onChoose(relic)} />
        ))}
      </div>

      <div className="flex flex-col items-center gap-3 w-full max-w-3xl">
        <p className="text-xs uppercase tracking-widest text-white/40">La tua squadra</p>
        <div data-testid="relic-squad" className="w-full">
          <SquadPanel picks={team} teamSize={team.length} layout="row" />
        </div>
        {synergies.length > 0 && (
          <div data-testid="relic-synergies" className="flex flex-wrap justify-center gap-1.5">
            {synergies.map((s) => (
              <span
                key={s.synergy.id}
                className="rounded-full border border-amber-300/40 bg-amber-300/10 px-2.5 py-0.5 text-xs font-semibold text-amber-200"
              >
                <span aria-hidden className="text-amber-300/80">✦ </span>{s.synergy.name}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col items-center gap-2">
        <p className="text-xs uppercase tracking-widest text-white/40">Le tue reliquie</p>
        <RelicBar relics={owned} />
      </div>
    </main>
  )
}
