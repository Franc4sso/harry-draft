'use client'
import { useState } from 'react'
import type { DraftedWizard } from '@/types'
import { detectSynergies } from '@/game/engine/synergy'
import { WizardCard } from '@/components/cards/WizardCard'
import { GlowPanel } from '@/components/ui/GlowPanel'
import { Button } from '@/components/ui/Button'

export function TeamScreen({ team, onRestart }: { team: DraftedWizard[]; onRestart?: () => void }) {
  const [soon, setSoon] = useState(false)
  const synergies = detectSynergies(team)
  return (
    <main className="flex-1 flex flex-col items-center gap-8 p-8">
      <h1 className="font-display text-4xl mt-4">La tua squadra</h1>

      <div className="flex flex-wrap justify-center gap-5">
        {team.map((m) => (
          <WizardCard key={m.wizard.id} drafted={m} />
        ))}
      </div>

      <GlowPanel className="p-5 w-full max-w-xl">
        <h2 className="font-display text-xl mb-3">Sinergie attive</h2>
        {synergies.length === 0 ? (
          <p className="text-white/60 text-sm">Nessuna sinergia attiva.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {synergies.map((s) => (
              <li
                key={s.synergy.id}
                className="px-3 py-1 rounded-full text-xs bg-white/10 border border-white/15"
              >
                {s.synergy.name}
              </li>
            ))}
          </ul>
        )}
      </GlowPanel>

      <div className="flex flex-col items-center gap-2">
        <div className="flex gap-3">
          <Button onClick={() => setSoon(true)}>Combatti</Button>
          {onRestart && <Button variant="ghost" onClick={onRestart}>Nuova run</Button>}
        </div>
        {soon && <p className="text-xs text-white/50">La campagna arriva nella prossima milestone.</p>}
      </div>
    </main>
  )
}
