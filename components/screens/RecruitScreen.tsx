'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { DraftedWizard } from '@/types'
import { WizardCardRow } from '@/components/cards/WizardCardRow'
import { WizardCardColumn } from '@/components/cards/WizardCardColumn'
import { Button } from '@/components/ui/Button'
import { Frame } from '@/components/ui/Frame'
import { Insegna } from '@/components/ui/Insegna'
import { Parchment } from '@/components/ui/Parchment'
import { Stagger, StaggerItem } from '@/components/ui/motion'
import { powerOf } from '@/game/engine/combat/teamGen'
import { previewSynergies, type SynergyPreview } from '@/game/engine/synergy'
import { synergyBonusText } from '@/lib/glossary'
import { displayName } from '@/lib/displayName'
import { isDead } from '@/game/engine/roster'

/** Right rail: the synergies that WOULD ACTIVATE if you recruit the focused
 *  candidate (accounting for the swap when the squad is full). Activation is the
 *  only thing shown — building-but-inactive synergies are deliberately omitted. */
function ActivationRail({ candidate, activating }: { candidate: DraftedWizard | null; activating: SynergyPreview[] }) {
  return (
    <Frame variant="panel" innerClassName="relative overflow-hidden">
      <Parchment className="absolute inset-0" />
      <div className="relative border-b border-white/10 bg-[#7cdc7c]/[0.06] px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">Sinergie attivate</p>
        <p className="mt-0.5 text-sm font-display text-white/90">
          {candidate ? <>Reclutando <span className="text-[#8ee68e]">{displayName(candidate)}</span></> : 'Scegli una recluta'}
        </p>
      </div>

      <div className="relative p-3">
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
                initial={{ opacity: 0, x: 6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 6 }}
                transition={{ duration: 0.12, ease: 'easeOut' }}
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
                <p className="mt-1 text-[11px] leading-snug text-[#cfeccf]">{synergyBonusText(p.synergy).join(' · ')}</p>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </Frame>
  )
}

export function RecruitScreen({
  offer, team, teamMax, onPick, onSkip,
}: {
  offer: DraftedWizard[]
  team: DraftedWizard[]
  teamMax: number
  onPick: (wizardId: string, replaceId?: string) => void
  /** Leave the node without recruiting (decline the offer / keep the squad as-is). */
  onSkip?: () => void
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
    // Layout copied verbatim from DraftScreen: a header above, then the exact same
    // two-column grid (candidates left / synergy rail right) using md:grid-cols-[1fr_280px].
    <main className="flex-1 w-full">
      <header className="px-4 pt-5">
        <Insegna kicker="Nuovo alleato" title="Reclutamento" />
        <p className="mt-2 text-center text-sm text-white/60">
          {full
            ? 'Squadra al completo: scegli chi reclutare e quale mago sostituire.'
            : 'Scegli un mago da aggiungere alla squadra.'}
        </p>
      </header>

      <div className="mx-auto grid max-w-5xl grid-cols-1 items-start gap-6 p-4 md:grid-cols-[1fr_280px]">
        {/* Left column: the candidate grid + (when full) the replacement list BELOW it at
            full width — the replace list must NOT sit inside the 3-col candidate grid, or it
            gets squeezed into a single cell (unreadable). */}
        <div className="flex flex-col gap-5">
        {/* Candidates — the SAME poster card as the first draft (WizardCardColumn),
            laid out side by side (sm+) like the draft's 3 candidates. */}
        <Stagger
          as="section"
          className="grid grid-cols-1 content-start gap-4 sm:grid-cols-2 lg:grid-cols-3"
          onPointerLeave={() => setConsidered(null)}
        >
          {offer.map(d => (
            <StaggerItem
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
              className="cursor-pointer rounded-2xl"
            >
              <WizardCardColumn drafted={d} selected={pick === d.wizard.id} />
            </StaggerItem>
          ))}
        </Stagger>

        {/* Replacement list — full width under the candidate grid when the squad is full. */}
        {full && (
            <div className="mt-1">
              <h2 className="mb-2 text-sm text-white/70">
                {pickedWizard
                  ? <>Sostituisci con <span className="font-semibold text-[#7cdc7c]">{displayName(pickedWizard)}</span>:</>
                  : 'Squadra piena — scegli chi sostituire:'}
              </h2>
              <div className="grid grid-cols-1 gap-2">
                {team.map(t => {
                  const removing = replaceId === t.wizard.id
                  const dead = isDead(t)
                  return (
                    // role=button (not <button>) so the WizardCardRow's tooltip buttons
                    // aren't nested inside a button (invalid DOM).
                    <div
                      key={t.wizard.id}
                      data-testid={`replace-${t.wizard.id}`}
                      role="button"
                      tabIndex={0}
                      aria-pressed={removing}
                      onClick={() => setReplaceId(t.wizard.id)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setReplaceId(t.wizard.id) }
                      }}
                      className="relative cursor-pointer rounded-2xl text-left transition"
                      style={{ boxShadow: removing ? '0 0 0 2px #f0727288, 0 0 14px #f0727255' : undefined }}
                    >
                      <span className={removing || dead ? 'block opacity-60 saturate-[0.85]' : 'block'}>
                        <WizardCardRow drafted={t} showLevel />
                      </span>
                      {removing && (
                        <span className="absolute right-3 top-3 rounded-full border border-rose-400/60 bg-rose-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-200">
                          Esce
                        </span>
                      )}
                      {dead && !removing && (
                        <span
                          data-testid={`dead-badge-${t.wizard.id}`}
                          className="absolute right-3 top-3 rounded-full border border-slate-400/50 bg-slate-700/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-300"
                        >
                          Morto
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Synergy rail (right column) — same sticky aside position as the draft. */}
        <aside>
          <div className="sticky top-28">
            <ActivationRail candidate={focus} activating={activating} />
          </div>
        </aside>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 px-4 pb-6">
        <Button
          variant="primary"
          disabled={!pick}
          onClick={() => pick && onPick(pick, full ? replaceId : undefined)}
        >
          {pick && full && replacedName ? `Recluta · sostituisci ${replacedName}` : 'Recluta'}
        </Button>
        {onSkip && (
          <Button variant="ghost" onClick={onSkip}>
            {full ? 'Non sostituire nessuno' : 'Non reclutare'}
          </Button>
        )}
      </div>
    </main>
  )
}
