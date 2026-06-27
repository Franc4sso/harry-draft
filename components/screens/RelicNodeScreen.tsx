'use client'
import { useState } from 'react'
import type { ActiveRelic, Relic } from '@/types'
import { RelicCard } from '@/components/relics/RelicCard'
import { Button } from '@/components/ui/Button'

export function RelicNodeScreen({
  offer, owned, onPick,
}: {
  offer: Relic[]
  owned: ActiveRelic[]
  onPick: (relicId: string) => void
}) {
  const [pick, setPick] = useState<string | null>(null)
  return (
    <main className="flex-1 flex flex-col items-center gap-6 p-6">
      <h1 className="font-display text-3xl">Scegli una reliquia</h1>
      {owned.length > 0 && <p className="text-white/50 text-sm">Reliquie possedute: {owned.length}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-4xl">
        {offer.map(r => (
          <div
            key={r.id}
            data-testid={`relic-${r.id}`}
            role="button"
            tabIndex={0}
            aria-pressed={pick === r.id}
            onClick={() => setPick(r.id)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPick(r.id) } }}
            className={pick === r.id ? 'ring-2 ring-amber-400 rounded-xl cursor-pointer' : 'cursor-pointer'}
          >
            <RelicCard relic={r} />
          </div>
        ))}
      </div>
      <Button variant="primary" disabled={!pick} onClick={() => pick && onPick(pick)}>Prendi</Button>
    </main>
  )
}
