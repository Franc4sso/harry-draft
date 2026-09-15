'use client'
import { useState } from 'react'
import type { ActiveRelic, DraftedWizard } from '@/types'
import { WizardCard } from '@/components/cards/WizardCard'
import { Button } from '@/components/ui/Button'
import { Frame } from '@/components/ui/Frame'
import { Insegna } from '@/components/ui/Insegna'
import { Parchment } from '@/components/ui/Parchment'
import { Stagger, StaggerItem } from '@/components/ui/motion'
import { powerOf } from '@/game/engine/combat/teamGen'
import { DuoTracker } from '@/components/draft/DuoTracker'
import { displayName } from '@/lib/displayName'
import { isDead } from '@/game/engine/roster'

export function RecruitScreen({
  offer, team, teamMax, relics, onPick, onSkip, noRecruits,
}: {
  offer: DraftedWizard[]
  team: DraftedWizard[]
  teamMax: number
  relics: ActiveRelic[]
  onPick: (wizardId: string, replaceId?: string) => void
  /** Leave the node without recruiting (decline the offer / keep the squad as-is). */
  onSkip?: () => void
  /** P5 — Voto Infrangibile (Patto): the run has permanently sworn off recruiting.
   *  The node stays visitable (so this message is reachable) but the pick is inert
   *  (recruitResolver silently no-ops on `noRecruits`, see game/engine/resolvers/recruit.ts). */
  noRecruits?: boolean
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
  const replacedName = full && replaceId
    ? displayName(team.find(t => t.wizard.id === replaceId)!)
    : undefined

  return (
    // Layout A (Reclutamento): "Entra ↔ Esce" — recruits as full cards on the left, the
    // current squad as row cards on the right, a swap arrow between them, and the combo
    // tracker as a band BELOW both columns (it already speaks "cosa cambia": with
    // `prevTeam` it marks what a swap lights, advances, or turns off).
    //
    // This screen is mounted inside RunBRunner's `withTeamSidebar`, a HEIGHT-BOUNDED flex
    // row (`h-[100dvh] min-h-0`, see that file's comment on the same overflow bug MapScreen
    // hit) — so `<main>` must itself be `flex-1 flex-col min-h-0` and let ONE inner region
    // scroll (`overflow-y-auto`), same as MapScreen, rather than growing to its content and
    // pushing the row (and the document) past the viewport.
    <main className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center justify-between gap-4 px-4 pt-3">
        <Insegna kicker="Nuovo alleato" title="Reclutamento" className="text-left [&_h1]:mt-0 [&_h1]:text-xl [&_.kicker]:mb-0 [&_.kicker]:text-[9px] [&_.kicker]:tracking-[0.3em] [&_[aria-hidden]]:hidden sm:[&_h1]:text-2xl" />
        {noRecruits ? (
          <p data-testid="recruit-blocked-reason" className="text-sm font-semibold text-rose-300">
            Il Voto Infrangibile è stato giurato — non puoi più reclutare.
          </p>
        ) : (
          <p className="text-sm text-white/60">
            {full
              ? 'Squadra al completo: scegli chi reclutare e quale mago sostituire.'
              : 'Scegli un mago da aggiungere alla squadra.'}
          </p>
        )}
      </header>

      {/* The one scrolling region: recruits | arrow | squad, then the "cosa cambia" band.
          min-h-0 lets it shrink inside the flex column instead of forcing the page taller. */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3 pt-2 [scrollbar-gutter:stable]">
        {/* 3fr/2fr split (not an even 1fr/1fr): the three recruit cards need real width to
            keep their spell name from wrapping mid-word, while the row-card squad list on
            the right stays legible much narrower. */}
        <div className="mx-auto grid max-w-[1340px] grid-cols-1 items-start gap-3 md:grid-cols-[3fr_auto_2fr]">
          {/* Left: recruits — the same full card as the draft, side by side (not stacked)
              so three cards don't tower over the row-card squad list. */}
          <Stagger
            as="section"
            className="grid grid-cols-3 content-start gap-2"
            onPointerLeave={() => setConsidered(null)}
          >
            {offer.map(d => (
              <StaggerItem key={d.wizard.id} className="h-full">
                <div onPointerEnter={() => setConsidered(d)} onFocus={() => setConsidered(d)}>
                  <WizardCard
                    drafted={d}
                    density="full"
                    portraitHeight={120}
                    selected={pick === d.wizard.id}
                    onClick={() => setPick(d.wizard.id)}
                    testId={`recruit-${d.wizard.id}`}
                  />
                </div>
              </StaggerItem>
            ))}
          </Stagger>

          {/* Swap arrow — "entra ↔ esce", between the two columns. Hidden on the mobile
              single-column stack (the columns aren't side by side there). */}
          <div aria-hidden className="hidden items-center justify-center self-stretch px-1 text-2xl text-[#b08d57] md:flex">
            ⇄
          </div>

          {/* Right: current squad — row cards, so the whole roster fits without scrolling.
              The member about to be replaced gets a red ring via className. */}
          <div className="flex flex-col gap-1.5">
            <h2 className="mb-1 text-[11px] uppercase tracking-widest text-white/50">
              {full
                ? (pickedWizard
                  ? <>Sostituisci con <span className="font-semibold text-[#7cdc7c]">{displayName(pickedWizard)}</span></>
                  : 'Squadra — scegli chi esce')
                : 'Squadra attuale'}
            </h2>
            {team.map(t => {
              const removing = full && replaceId === t.wizard.id
              const dead = isDead(t)
              return (
                // role=button (not <button>) so WizardCard's own interactive bits never
                // nest inside a button (invalid DOM), same reasoning as before.
                <div
                  key={t.wizard.id}
                  data-testid={`replace-${t.wizard.id}`}
                  role={full ? 'button' : undefined}
                  tabIndex={full ? 0 : undefined}
                  aria-pressed={full ? removing : undefined}
                  onClick={full ? () => setReplaceId(t.wizard.id) : undefined}
                  onKeyDown={full ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setReplaceId(t.wizard.id) } } : undefined}
                  className="relative"
                >
                  <WizardCard
                    drafted={t}
                    density="row"
                    currentHp={t.currentHp}
                    className={removing || dead ? `opacity-60 saturate-[0.85] ${full ? 'cursor-pointer' : ''} ${removing ? 'ring-2 ring-rose-400' : ''}` : full ? 'cursor-pointer' : ''}
                  />
                  {removing && (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full border border-rose-400/60 bg-rose-500/20 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-rose-200">
                      Esce
                    </span>
                  )}
                  {dead && !removing && (
                    <span
                      data-testid={`dead-badge-${t.wizard.id}`}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full border border-slate-400/50 bg-slate-700/60 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-300"
                    >
                      Morto
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* "Cosa cambia" band — full width, below both columns. Same single Duo panel as
            the draft: signals with their grade + the combos they light. With `prevTeam`
            it also marks what a swap turns OFF (combo, signal, or a Trio). */}
        <div className="mx-auto max-w-[1340px] pt-3">
          <Frame variant="panel" innerClassName="relative p-3">
            <Parchment className="absolute inset-0" />
            <div className="relative">
              <DuoTracker picks={baseTeam} considered={focus} relics={relics} prevTeam={full ? team : undefined} />
            </div>
          </Frame>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-center gap-3 px-4 pb-3 pt-2">
        <Button
          variant="primary"
          disabled={!pick || noRecruits}
          onClick={() => pick && !noRecruits && onPick(pick, full ? replaceId : undefined)}
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
