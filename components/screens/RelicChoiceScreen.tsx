'use client'
import type { ActiveRelic, Relic } from '@/types'
import { RelicCard } from '@/components/relics/RelicCard'
import { RelicBar } from '@/components/relics/RelicBar'

export function RelicChoiceScreen({
  choices, owned, onChoose,
}: {
  choices: Relic[]
  owned: ActiveRelic[]
  onChoose: (relic: Relic) => void
}) {
  return (
    <main className="flex-1 flex flex-col items-center justify-center gap-8 p-8">
      <h1 className="font-display text-4xl">Scegli una reliquia</h1>
      <div className="flex flex-wrap justify-center gap-5">
        {choices.map((relic) => (
          <RelicCard key={relic.id} relic={relic} onClick={() => onChoose(relic)} />
        ))}
      </div>
      <div className="flex flex-col items-center gap-2">
        <p className="text-xs uppercase tracking-widest text-white/40">Le tue reliquie</p>
        <RelicBar relics={owned} />
      </div>
    </main>
  )
}
