'use client'
import { useState } from 'react'
import type { DraftedWizard } from '@/types'
import { WizardCard } from '@/components/cards/WizardCard'
import { WizardCardRow } from '@/components/cards/WizardCardRow'
import { SynergyTracker } from '@/components/draft/SynergyTracker'
import { Button } from '@/components/ui/Button'
import { powerOf } from '@/game/engine/combat/teamGen'
import { synergyProgress, previewSynergies, type SynergyPreview } from '@/game/engine/synergy'
import { displayName } from '@/lib/displayName'

/** Per-card glance: which synergies this recruit would activate or build toward. */
function ImpactRibbon({ previews }: { previews: SynergyPreview[] }) {
  const advancing = [...previews]
    .filter(p => p.advances)
    .sort((a, b) => Number(b.willActivate) - Number(a.willActivate) || b.nextCount - a.nextCount)
  if (advancing.length === 0) {
    return <p className="mt-1.5 text-center text-[10px] text-white/35">Nessuna nuova sinergia</p>
  }
  return (
    <div className="mt-1.5 flex flex-wrap justify-center gap-1">
      {advancing.slice(0, 3).map(p => {
        const name = p.synergy.name.replace(/^\d+\s+/, '')
        return p.willActivate ? (
          <span
            key={p.synergy.id}
            className="inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold"
            style={{ color: '#bdf0bd', borderColor: 'rgba(124,220,124,0.5)', background: 'rgba(124,220,124,0.14)' }}
          >
            <span aria-hidden>✦</span>{name}
          </span>
        ) : (
          <span
            key={p.synergy.id}
            className="inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold"
            style={{ color: '#ead9b0', borderColor: 'rgba(176,141,87,0.5)', background: 'rgba(176,141,87,0.14)' }}
          >
            +{p.nextCount - p.count} {name}
          </span>
        )
      })}
    </div>
  )
}

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
  const [considered, setConsidered] = useState<DraftedWizard | null>(null)
  const [replaceId, setReplaceId] = useState<string | undefined>(weakestId)

  const pickedWizard = pick ? offer.find(d => d.wizard.id === pick) ?? null : null
  // What the synergy rail previews: the hovered candidate, else the selected one.
  const previewCand = considered ?? pickedWizard
  // When the squad is full a recruit swaps someone out, so the synergy baseline is
  // the team WITHOUT the wizard being replaced; the candidate is then added on top.
  const baseTeam = full && replaceId ? team.filter(t => t.wizard.id !== replaceId) : team
  const rows = previewCand ? previewSynergies(baseTeam, previewCand) : synergyProgress(team)
  const replacedName = full && replaceId
    ? displayName(team.find(t => t.wizard.id === replaceId)!)
    : undefined

  return (
    <main className="flex-1 flex flex-col items-center gap-5 p-6">
      <div className="text-center">
        <h1 className="font-display text-3xl">Reclutamento</h1>
        <p className="mt-1 text-sm text-white/60">
          {full
            ? 'Squadra al completo: scegli chi reclutare e quale mago sostituire.'
            : 'Scegli un mago da aggiungere alla squadra.'}
        </p>
      </div>

      <div className="grid w-full max-w-5xl grid-cols-1 items-start gap-6 md:grid-cols-[1fr_300px]">
        {/* Offer + (when full) the swap roster */}
        <div className="flex flex-col gap-5">
          <section
            className="grid grid-cols-1 gap-4 sm:grid-cols-3"
            onPointerLeave={() => setConsidered(null)}
          >
            {offer.map(d => (
              <div
                key={d.wizard.id}
                data-testid={`recruit-${d.wizard.id}`}
                role="button"
                tabIndex={0}
                aria-pressed={pick === d.wizard.id}
                onClick={() => setPick(d.wizard.id)}
                onPointerEnter={() => setConsidered(d)}
                onFocus={() => setConsidered(d)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setPick(d.wizard.id)
                  }
                }}
                className="cursor-pointer rounded-xl"
              >
                <WizardCard drafted={d} selected={pick === d.wizard.id} />
                <ImpactRibbon previews={previewSynergies(baseTeam, d)} />
              </div>
            ))}
          </section>

          {full && (
            <div className="w-full">
              <h2 className="mb-2 text-sm text-white/70">
                {pickedWizard
                  ? <>Sostituisci con <span className="font-semibold text-[#7cdc7c]">{displayName(pickedWizard)}</span>:</>
                  : 'Squadra piena — scegli chi sostituire:'}
              </h2>
              <div className="flex flex-col gap-2">
                {team.map(t => {
                  const removing = replaceId === t.wizard.id
                  return (
                    <button
                      key={t.wizard.id}
                      data-testid={`replace-${t.wizard.id}`}
                      onClick={() => setReplaceId(t.wizard.id)}
                      className="relative rounded-2xl text-left transition"
                      style={{ boxShadow: removing ? '0 0 0 2px #f0727288, 0 0 14px #f0727255' : undefined }}
                    >
                      <span className={removing ? 'block opacity-60 saturate-[0.85]' : 'block'}>
                        <WizardCardRow drafted={t} showLevel />
                      </span>
                      {removing && (
                        <span className="absolute right-3 top-3 rounded-full border border-rose-400/60 bg-rose-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-200">
                          Esce
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Synergy rail — current team synergies, or the preview for a candidate. */}
        <aside className="md:sticky md:top-4">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <SynergyTracker rows={rows} candidateName={previewCand ? displayName(previewCand) : undefined} />
          </div>
        </aside>
      </div>

      <Button
        variant="primary"
        disabled={!pick}
        onClick={() => pick && onPick(pick, full ? replaceId : undefined)}
      >
        {pick && full && replacedName ? `Recluta · sostituisci ${replacedName}` : 'Recluta'}
      </Button>
    </main>
  )
}
