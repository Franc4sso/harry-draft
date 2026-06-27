'use client'
import { useState } from 'react'
import type { DraftedWizard } from '@/types'
import { WizardCard } from '@/components/cards/WizardCard'
import { WizardCardRow } from '@/components/cards/WizardCardRow'
import { Button } from '@/components/ui/Button'
import { powerOf } from '@/game/engine/combat/teamGen'

export function RecruitScreen({
  offer, team, teamMax, onPick,
}: {
  offer: DraftedWizard[]
  team: DraftedWizard[]
  teamMax: number
  onPick: (wizardId: string, replaceId?: string) => void
}) {
  const full = team.length >= teamMax
  const weakestId = full
    ? [...team].sort((a, b) => powerOf(a) - powerOf(b))[0]!.wizard.id
    : undefined
  const [pick, setPick] = useState<string | null>(null)
  const [replaceId, setReplaceId] = useState<string | undefined>(weakestId)

  return (
    <main className="flex-1 flex flex-col items-center gap-6 p-6">
      <h1 className="font-display text-3xl">Reclutamento</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-4xl">
        {offer.map(d => (
          <div
            key={d.wizard.id}
            data-testid={`recruit-${d.wizard.id}`}
            role="button"
            tabIndex={0}
            aria-pressed={pick === d.wizard.id}
            onClick={() => setPick(d.wizard.id)}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                setPick(d.wizard.id)
              }
            }}
            className="cursor-pointer rounded-xl"
          >
            <WizardCard drafted={d} selected={pick === d.wizard.id} />
          </div>
        ))}
      </div>

      {full && (
        <div className="w-full max-w-3xl">
          <h2 className="text-sm text-white/60 mb-2">Squadra piena — scegli chi sostituire</h2>
          <div className="flex flex-col gap-2">
            {team.map(t => (
              <button
                key={t.wizard.id}
                data-testid={`replace-${t.wizard.id}`}
                onClick={() => setReplaceId(t.wizard.id)}
                className={`text-left ${replaceId === t.wizard.id ? 'ring-1 ring-amber-400 rounded-lg' : ''}`}
              >
                <WizardCardRow drafted={t} />
              </button>
            ))}
          </div>
        </div>
      )}

      <Button
        variant="primary"
        disabled={!pick}
        onClick={() => pick && onPick(pick, full ? replaceId : undefined)}
      >
        Recluta
      </Button>
    </main>
  )
}
