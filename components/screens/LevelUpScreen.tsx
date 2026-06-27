'use client'
import type { ActiveRelic, ActiveSynergy, DraftedWizard, GrowthChoice, PendingLevelUp } from '@/types'
import { statBreakdown } from '@/lib/statBreakdown'
import { WizardCardRow } from '@/components/cards/WizardCardRow'
import { Button } from '@/components/ui/Button'
import { displayName } from '@/lib/displayName'

const OPTIONS: { kind: GrowthChoice['kind']; label: string }[] = [
  { kind: 'atk', label: 'Attacco' }, { kind: 'def', label: 'Difesa' },
  { kind: 'spd', label: 'Velocità' }, { kind: 'hp', label: 'Salute' },
]

export function LevelUpScreen({
  pending, wizard, team, synergies, relics, onChoose,
}: {
  pending: PendingLevelUp
  wizard: DraftedWizard
  team: DraftedWizard[]
  synergies: ActiveSynergy[]
  relics: ActiveRelic[]
  onChoose: (choice: GrowthChoice) => void
}) {
  const layers = statBreakdown(wizard, team, synergies, relics)
  return (
    <main className="flex-1 flex flex-col items-center gap-6 p-6">
      <h1 className="font-display text-3xl">Livello {pending.atLevel}!</h1>
      <p className="text-white/70">{displayName(wizard)} ha raggiunto una soglia. Scegli un potenziamento.</p>
      <WizardCardRow drafted={wizard} />
      <div className="text-xs text-white/50 flex gap-4">
        <span>Base {layers.base.atk}/{layers.base.def}/{layers.base.spd}</span>
        <span>Livello {layers.afterLevel.atk}/{layers.afterLevel.def}/{layers.afterLevel.spd}</span>
        <span>Totale {layers.total.atk}/{layers.total.def}/{layers.total.spd}</span>
      </div>
      <div className="grid grid-cols-2 gap-3 max-w-md w-full">
        {OPTIONS.map(o => (
          <Button key={o.kind} variant="primary" onClick={() => onChoose({ atLevel: pending.atLevel, kind: o.kind })}>
            +{o.label}
          </Button>
        ))}
      </div>
    </main>
  )
}
