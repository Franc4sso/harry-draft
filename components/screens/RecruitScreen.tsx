'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { DraftedWizard } from '@/types'
import { WizardCard } from '@/components/cards/WizardCard'
import { WizardCardRow } from '@/components/cards/WizardCardRow'
import { Button } from '@/components/ui/Button'
import { powerOf } from '@/game/engine/combat/teamGen'
import { previewSynergies, type SynergyPreview } from '@/game/engine/synergy'
import { synergyBonusText } from '@/lib/glossary'
import { displayName } from '@/lib/displayName'

/** Right rail: the synergies that WOULD ACTIVATE if you recruit the focused
 *  candidate (accounting for the swap when the squad is full). Activation is the
 *  only thing shown — building-but-inactive synergies are deliberately omitted. */
function ActivationRail({ candidate, activating }: { candidate: DraftedWizard | null; activating: SynergyPreview[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02]">
      <div className="border-b border-white/10 bg-[#7cdc7c]/[0.06] px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">Sinergie attivate</p>
        <p className="mt-0.5 text-sm font-display text-white/90">
          {candidate ? <>Reclutando <span className="text-[#8ee68e]">{displayName(candidate)}</span></> : 'Scegli una recluta'}
        </p>
      </div>

      <div className="p-3">
        {!candidate && (
          <p className="px-1 py-6 text-center text-xs text-white/40">
            Passa sopra o seleziona una recluta per vedere quali sinergie attiva.
          </p>
        )}
        {candidate && activating.length === 0 && (
          <p className="px-1 py-6 text-center text-xs text-white/45">
            Nessuna sinergia si attiva con questa scelta.
          </p>
        )}
        <div className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {activating.map(p => (
              <motion.div
                key={p.synergy.id}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                className="rounded-xl border p-2.5"
                style={{ borderColor: 'rgba(124,220,124,0.5)', background: 'rgba(124,220,124,0.10)', boxShadow: '0 0 16px rgba(124,220,124,0.14)' }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-white/95">
                    <span aria-hidden className="text-[#8ee68e]">✦</span>
                    {p.synergy.name.replace(/^\d+\s+/, '')}
                  </span>
                  <span className="shrink-0 rounded-full bg-[#7cdc7c]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#8ee68e]">
                    si attiva
                  </span>
                </div>
                <p className="mt-1 text-[11px] leading-snug text-[#cfeccf]">{synergyBonusText(p.synergy.bonus).join(' · ')}</p>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
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
  const focus = considered ?? pickedWizard
  // When the squad is full a recruit swaps someone out, so synergy activation is
  // evaluated against the team WITHOUT the wizard being replaced.
  const baseTeam = full && replaceId ? team.filter(t => t.wizard.id !== replaceId) : team
  const activating = focus ? previewSynergies(baseTeam, focus).filter(p => p.willActivate) : []
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

      <div className="grid w-full max-w-5xl grid-cols-1 items-start gap-6 sm:grid-cols-[1fr_300px]">
        {/* Offer + (when full) the swap roster */}
        <div className="flex flex-col gap-5">
          {/* Candidates as a single horizontal row (mirrors the draft), wrapping
              only on genuinely narrow screens. */}
          <section
            className="flex flex-row flex-wrap content-start justify-center gap-4"
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

        {/* Activation rail — always the right-hand column from sm up, sticky there. */}
        <aside className="sm:sticky sm:top-4">
          <ActivationRail candidate={focus} activating={activating} />
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
