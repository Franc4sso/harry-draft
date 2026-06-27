'use client'
import { useState } from 'react'
import type { DraftedWizard, House } from '@/types'
import { WizardCard } from '@/components/cards/WizardCard'
import { Button } from '@/components/ui/Button'
import { SquadPanel } from '@/components/draft/SquadPanel'

export function StarterPickScreen({
  house, offer, onConfirm, onBack,
}: {
  house: House
  offer: DraftedWizard[]
  onConfirm: (ids: string[]) => void
  onBack: () => void
}) {
  const [picked, setPicked] = useState<string[]>([])
  const toggle = (id: string) =>
    setPicked(p => p.includes(id) ? p.filter(x => x !== id) : p.length < 2 ? [...p, id] : p)
  const pickedWizards = picked
    .map(id => offer.find(d => d.wizard.id === id))
    .filter((d): d is DraftedWizard => !!d)

  return (
    <main className="flex-1 flex flex-col items-center gap-6 p-6">
      <h1 className="font-display text-3xl">Scegli 2 maghi — {house}</h1>
      <SquadPanel picks={pickedWizards} teamSize={2} layout="row" />
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-w-5xl">
        {offer.map(d => (
          <div
            key={d.wizard.id}
            data-testid={`pick-${d.wizard.id}`}
            role="button"
            tabIndex={0}
            aria-pressed={picked.includes(d.wizard.id)}
            onClick={() => toggle(d.wizard.id)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(d.wizard.id) } }}
            className="cursor-pointer rounded-xl"
          >
            <WizardCard drafted={d} selected={picked.includes(d.wizard.id)} />
          </div>
        ))}
      </div>
      <div className="flex gap-3">
        <Button variant="ghost" onClick={onBack}>Indietro</Button>
        <Button variant="primary" disabled={picked.length !== 2} onClick={() => onConfirm(picked)}>
          Inizia ({picked.length}/2)
        </Button>
      </div>
    </main>
  )
}
