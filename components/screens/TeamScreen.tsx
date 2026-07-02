'use client'
import type { DraftedWizard } from '@/types'
import { detectSynergies } from '@/game/engine/synergy'
import { synergyBonusText } from '@/lib/glossary'
import { WizardCardRow } from '@/components/cards/WizardCardRow'
import { Button } from '@/components/ui/Button'
import { Frame } from '@/components/ui/Frame'
import { Insegna } from '@/components/ui/Insegna'
import { displayName } from '@/lib/displayName'

export function TeamScreen({
  team, onConfirm, onRestart,
}: {
  team: DraftedWizard[]
  onConfirm?: () => void
  onRestart?: () => void
}) {
  const synergies = detectSynergies(team)
  const nameById = new Map(team.map((d) => [d.wizard.id, displayName(d)]))

  return (
    <main className="flex-1 flex flex-col items-center gap-7 p-6">
      <div className="mt-2">
        <Insegna kicker="Il tuo schieramento" title="La tua squadra" />
      </div>

      {/* Synergies first — a modern gold band at the top, before the roster. */}
      <section className="w-full max-w-3xl">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-display text-lg">Sinergie attive</h2>
          <span className="text-[11px] uppercase tracking-widest text-amber-200/70">
            {synergies.length} {synergies.length === 1 ? 'attiva' : 'attive'}
          </span>
        </div>

        {synergies.length === 0 ? (
          <Frame variant="panel" innerClassName="p-4">
            <p className="text-sm text-white/55">Nessuna sinergia attiva.</p>
          </Frame>
        ) : (
          <div className="flex flex-wrap gap-2.5">
            {synergies.map((s) => {
              const members = s.memberIds.map((id) => nameById.get(id)).filter(Boolean) as string[]
              return (
                <div
                  key={s.synergy.id}
                  className="flex items-center gap-3 rounded-2xl border border-amber-300/25 bg-gradient-to-br from-amber-300/[0.12] to-transparent px-3.5 py-2.5"
                >
                  <span aria-hidden className="text-lg leading-none text-amber-300">✦</span>
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="font-display text-sm leading-tight">{s.synergy.name.replace(/^\d+\s+/, '')}</span>
                    <div className="flex flex-wrap gap-1">
                      {synergyBonusText(s.synergy).map((t) => (
                        <span
                          key={t}
                          className="rounded-full bg-emerald-300/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-200"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                  <span
                    title={members.join(' · ')}
                    className="ml-1 shrink-0 rounded-full bg-black/30 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-white/60"
                  >
                    ×{members.length}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Roster — horizontal cards, consistent with the draft. */}
      <div className="flex w-full max-w-3xl flex-col gap-3">
        {team.map((m) => (
          <WizardCardRow key={m.wizard.id} drafted={m} showLevel />
        ))}
      </div>

      <div className="flex gap-3">
        <Button onClick={onConfirm}>Combatti</Button>
        {onRestart && <Button variant="ghost" onClick={onRestart}>Nuova run</Button>}
      </div>
    </main>
  )
}
