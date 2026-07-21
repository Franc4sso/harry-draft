'use client'
import { useState } from 'react'
import { Flame } from 'lucide-react'
import type { ActiveRelic, DraftedWizard, Relic } from '@/types'
import { canPay, type SacrificeCost } from '@/game/engine/sacrifice'
import { isDead } from '@/game/engine/roster'
import { Button } from '@/components/ui/Button'
import { Frame } from '@/components/ui/Frame'
import { Insegna } from '@/components/ui/Insegna'
import { Stagger, StaggerItem } from '@/components/ui/motion'
import { RELIC_RARITY_COLOR } from '@/lib/relicRarity'
import { displayName } from '@/lib/displayName'
import { RelicSwapPanel } from '@/components/relics/RelicSwapPanel'
import { BALANCE } from '@/data/constants'

/** Human-readable POWER line for a Sacrifice Relic — the `desc` already carries the
 *  full flavor + cost sentence, so POWER is just the part before "COSTO:". */
function powerText(relic: Relic): string {
  return relic.desc.split(/\s*COSTO:/i)[0]!.trim()
}

/** Human-readable COST line, independent of whether a selection has been made yet. */
function costText(relic: Relic): string {
  const cost = relic.sacrificeCost
  if (!cost) return '—'
  switch (cost.kind) {
    case 'wizard': return 'Sacrifica un mago a tua scelta'
    case 'relic': return 'Perdi una reliquia a tua scelta'
    case 'maxHp': return `Un mago perde ${cost.amount} vita massima per sempre`
  }
}

/** Whether at least ONE valid selection exists to satisfy this relic's cost (used to
 *  disable an offer outright, e.g. a relic-cost relic when you own no relics, or a
 *  wizard-cost relic when the squad is at the 2-wizard floor — see sacrifice.ts canPay). */
function isPayable(relic: Relic, state: Parameters<typeof canPay>[0]): boolean {
  const t = relic.sacrificeCost
  if (!t) return false
  if (t.kind === 'wizard') return state.team.some(d => canPay(state, { kind: 'wizard', wizardId: d.wizard.id }))
  if (t.kind === 'relic') return state.relics.some(a => canPay(state, { kind: 'relic', relicId: a.relic.id }))
  return state.team.some(d => canPay(state, { kind: 'maxHp', wizardId: d.wizard.id, amount: t.amount }))
}

function Altar({
  relic, selected, payable, onSelect,
}: { relic: Relic; selected: boolean; payable: boolean; onSelect: () => void }) {
  const color = RELIC_RARITY_COLOR[relic.rarity]
  return (
    <Frame
      variant="card"
      className={payable ? 'h-full cursor-pointer transition-transform duration-200 hover:-translate-y-1.5' : 'h-full'}
      innerClassName="relative flex h-full flex-col items-center gap-2 p-5 text-center"
      style={{
        boxShadow: selected ? `0 0 0 2px ${color}, 0 0 26px ${color}66` : `0 0 18px ${color}22`,
        opacity: payable ? 1 : 0.5,
      }}
      data-testid={`altare-offer-${relic.id}`}
      role="button"
      aria-disabled={!payable}
      aria-pressed={selected}
      tabIndex={payable ? 0 : -1}
      onClick={() => payable && onSelect()}
      onKeyDown={(e) => { if (payable && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onSelect() } }}
    >
      <Flame size={36} style={{ color }} aria-hidden />
      <h3 className="font-display text-base leading-tight">{relic.name}</h3>
      <p data-testid={`altare-power-${relic.id}`} className="text-sm leading-relaxed text-white/75">
        {powerText(relic)}
      </p>
      <p data-testid={`altare-cost-${relic.id}`} className="text-xs font-semibold uppercase tracking-wide text-rose-300/85">
        Costo: {costText(relic)}
      </p>
      {!payable && (
        <p data-testid={`altare-reason-${relic.id}`} className="text-[11px] text-white/45">
          Non puoi pagare questo prezzo ora.
        </p>
      )}
    </Frame>
  )
}

export function AltareScreen({
  offers, team, owned, onBuy, onSkip,
}: {
  offers: Relic[]
  team: DraftedWizard[]
  owned: ActiveRelic[]
  onBuy: (relicId: string, choice: { costWizardId?: string; costRelicId?: string; carrierId?: string; replaceRelicId?: string }) => void
  onSkip: () => void
}) {
  const [pick, setPick] = useState<string | null>(null)
  const [costWizardId, setCostWizardId] = useState<string | null>(null)
  const [costRelicId, setCostRelicId] = useState<string | null>(null)
  const [carrierId, setCarrierId] = useState<string | null>(null)
  const atCap = owned.length >= BALANCE.relics.maxRelics

  const pseudoState = { team, relics: owned } as Parameters<typeof canPay>[0]
  const pickedRelic = offers.find(r => r.id === pick)
  const costKind = pickedRelic?.sacrificeCost?.kind
  const needsWizardPick = costKind === 'wizard' || costKind === 'maxHp'
  const needsRelicPick = costKind === 'relic'
  const needsCarrierPick = Boolean(pickedRelic?.assignable)

  const selectOffer = (relicId: string) => {
    setPick(relicId); setCostWizardId(null); setCostRelicId(null); setCarrierId(null)
  }

  const concreteCost: SacrificeCost | null = !pickedRelic?.sacrificeCost
    ? null
    : pickedRelic.sacrificeCost.kind === 'wizard' && costWizardId
      ? { kind: 'wizard', wizardId: costWizardId }
      : pickedRelic.sacrificeCost.kind === 'relic' && costRelicId
        ? { kind: 'relic', relicId: costRelicId }
        : pickedRelic.sacrificeCost.kind === 'maxHp' && costWizardId
          ? { kind: 'maxHp', wizardId: costWizardId, amount: pickedRelic.sacrificeCost.amount }
          : null

  const canConfirm = Boolean(
    pickedRelic && concreteCost && canPay(pseudoState, concreteCost) && (!needsCarrierPick || carrierId),
  )

  const confirm = (replaceRelicId?: string) => {
    if (!pickedRelic || !canConfirm) return
    onBuy(pickedRelic.id, {
      costWizardId: costWizardId ?? undefined,
      costRelicId: costRelicId ?? undefined,
      carrierId: carrierId ?? undefined,
      replaceRelicId,
    })
  }

  return (
    <main data-testid="altare-screen" className="flex-1 flex flex-col items-center gap-6 p-6">
      <Insegna kicker="Un patto proibito" title="Altare Oscuro" />
      <p className="max-w-xl text-center text-sm text-white/60">
        Ogni reliquia qui ha un prezzo che si paga per sempre. Scegli con cura — o vai via.
      </p>

      <Stagger delay={0.15} className="grid max-w-4xl grid-cols-1 gap-6 sm:grid-cols-3">
        {offers.map(r => (
          <StaggerItem key={r.id} className="h-full">
            <Altar
              relic={r}
              selected={pick === r.id}
              payable={isPayable(r, pseudoState)}
              onSelect={() => selectOffer(r.id)}
            />
          </StaggerItem>
        ))}
      </Stagger>

      {pickedRelic && needsCarrierPick && (
        <div className="w-full max-w-3xl">
          <p className="mb-2 text-center text-[10px] uppercase tracking-[0.25em] text-white/45">
            A chi la assegni?
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {team.map(dw => (
              <button
                key={dw.wizard.id}
                data-testid={`altare-carrier-${dw.wizard.id}`}
                onClick={() => setCarrierId(dw.wizard.id)}
                aria-pressed={carrierId === dw.wizard.id}
                className="rounded-lg border px-3 py-2 text-sm transition-colors"
                style={{
                  borderColor: carrierId === dw.wizard.id ? '#f0727288' : 'rgba(255,255,255,0.18)',
                  background: carrierId === dw.wizard.id ? 'rgba(240,114,114,0.15)' : 'transparent',
                }}
              >
                {displayName(dw)}
              </button>
            ))}
          </div>
        </div>
      )}

      {pickedRelic && needsWizardPick && (
        <div className="w-full max-w-3xl">
          <p className="mb-2 text-center text-[10px] uppercase tracking-[0.25em] text-white/45">
            {pickedRelic.sacrificeCost?.kind === 'wizard' ? 'Sacrifica…' : 'Chi perde vita massima…'}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {(pickedRelic.sacrificeCost?.kind === 'maxHp' ? team.filter(dw => !isDead(dw)) : team).map(dw => {
              const affordable = pickedRelic.sacrificeCost?.kind === 'wizard'
                ? canPay(pseudoState, { kind: 'wizard', wizardId: dw.wizard.id })
                : canPay(pseudoState, { kind: 'maxHp', wizardId: dw.wizard.id, amount: (pickedRelic.sacrificeCost as { amount: number }).amount })
              return (
                <button
                  key={dw.wizard.id}
                  data-testid={`altare-pick-wizard-${dw.wizard.id}`}
                  disabled={!affordable}
                  onClick={() => setCostWizardId(dw.wizard.id)}
                  aria-pressed={costWizardId === dw.wizard.id}
                  className="rounded-lg border px-3 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                  style={{
                    borderColor: costWizardId === dw.wizard.id ? '#f0727288' : 'rgba(255,255,255,0.18)',
                    background: costWizardId === dw.wizard.id ? 'rgba(240,114,114,0.15)' : 'transparent',
                  }}
                >
                  {displayName(dw)}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {pickedRelic && needsRelicPick && (
        <div className="w-full max-w-3xl">
          <p className="mb-2 text-center text-[10px] uppercase tracking-[0.25em] text-white/45">Perdi…</p>
          <div className="flex flex-wrap justify-center gap-2">
            {owned.length === 0 && <p className="text-xs text-white/45">Non possiedi reliquie da perdere.</p>}
            {owned.map(a => (
              <button
                key={a.relic.id}
                data-testid={`altare-pick-relic-${a.relic.id}`}
                onClick={() => setCostRelicId(a.relic.id)}
                aria-pressed={costRelicId === a.relic.id}
                className="rounded-lg border px-3 py-2 text-sm transition-colors"
                style={{
                  borderColor: costRelicId === a.relic.id ? '#f0727288' : 'rgba(255,255,255,0.18)',
                  background: costRelicId === a.relic.id ? 'rgba(240,114,114,0.15)' : 'transparent',
                }}
              >
                {a.relic.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {atCap && pickedRelic && canConfirm ? (
        <RelicSwapPanel
          incoming={pickedRelic}
          owned={owned}
          onSwap={(replaceRelicId) => confirm(replaceRelicId)}
          onReject={() => { setPick(null); setCostWizardId(null); setCostRelicId(null); setCarrierId(null) }}
        />
      ) : (
        <div className="flex items-center gap-3">
          {pickedRelic && (
            <Button
              variant="danger"
              disabled={!canConfirm}
              data-testid={pickedRelic ? `altare-confirm-${pickedRelic.id}` : undefined}
              onClick={() => confirm()}
            >
              Paga il prezzo
            </Button>
          )}
          <Button variant="ghost" onClick={onSkip}>Vai via</Button>
        </div>
      )}
    </main>
  )
}
