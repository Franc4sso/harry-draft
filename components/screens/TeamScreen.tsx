'use client'
import type { DraftedWizard } from '@/types'
import { detectSynergies } from '@/game/engine/synergy'
import { synergyBonusText } from '@/lib/glossary'
import { WizardCard } from '@/components/cards/WizardCard'
import { GlowPanel } from '@/components/ui/GlowPanel'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'

export function TeamScreen({
  team, onConfirm, onRestart,
}: {
  team: DraftedWizard[]
  onConfirm?: () => void
  onRestart?: () => void
}) {
  const synergies = detectSynergies(team)
  const nameById = new Map(team.map((d) => [d.wizard.id, d.wizard.name]))
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
          <ul className="flex flex-col gap-3">
            {synergies.map((s) => {
              const members = s.memberIds.map((id) => nameById.get(id)).filter(Boolean) as string[]
              return (
                <li key={s.synergy.id} className="rounded-xl bg-white/5 border border-white/10 p-3">
                  <p className="font-display text-base">{s.synergy.name}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {synergyBonusText(s.synergy.bonus).map((t) => (
                      <Chip key={t} label={t} color="#7CFC9B" />
                    ))}
                  </div>
                  {members.length > 0 && (
                    <p className="mt-1.5 text-xs text-white/55">{members.join(' · ')}</p>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </GlowPanel>

      <div className="flex gap-3">
        <Button onClick={onConfirm}>Combatti</Button>
        {onRestart && <Button variant="ghost" onClick={onRestart}>Nuova run</Button>}
      </div>
    </main>
  )
}
