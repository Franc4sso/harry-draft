'use client'
import { useState } from 'react'
import { Gem, Sparkles } from 'lucide-react'
import type { ActiveRelic, DraftedWizard, Relic } from '@/types'
import { Button } from '@/components/ui/Button'
import { Frame } from '@/components/ui/Frame'
import { Insegna } from '@/components/ui/Insegna'
import { Stagger, StaggerItem } from '@/components/ui/motion'
import { Tooltip } from '@/components/ui/Tooltip'
import { RELIC_RARITY_COLOR } from '@/lib/relicRarity'
import { RelicSwapPanel } from '@/components/relics/RelicSwapPanel'
import { BALANCE } from '@/data/constants'

/** Compact rarity-tinted sigil for a relic already in the collection. */
function OwnedSigil({ relic }: { relic: Relic }) {
  const color = RELIC_RARITY_COLOR[relic.rarity]
  const Icon = relic.triggers?.length ? Sparkles : Gem
  return (
    <Tooltip
      label={relic.name}
      content={<><span className="font-semibold text-white/90">{relic.name}</span><br />{relic.desc}</>}
    >
      <span
        className="grid h-9 w-9 place-items-center rounded-lg border"
        style={{ borderColor: `${color}66`, background: `${color}1a` }}
      >
        <Icon size={16} style={{ color }} aria-hidden />
      </span>
    </Tooltip>
  )
}

/** A single relic presented as an artifact glowing on a lit pedestal. */
function Pedestal({ relic, selected, onSelect }: { relic: Relic; selected: boolean; onSelect: () => void }) {
  const color = RELIC_RARITY_COLOR[relic.rarity]
  const reactive = Boolean(relic.triggers?.length)
  const Icon = reactive ? Sparkles : Gem
  return (
    <Frame
      variant="card"
      className="h-full cursor-pointer transition-transform duration-200 hover:-translate-y-1.5"
      innerClassName="relative flex h-full flex-col items-center p-5 text-center"
      style={{ boxShadow: selected ? `0 0 0 2px ${color}, 0 0 26px ${color}66` : `0 0 18px ${color}22` }}
      data-testid={`relic-${relic.id}`}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={onSelect}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect() } }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: `radial-gradient(120% 80% at 50% 0%, ${color}1f, transparent 62%)` }}
      />
      {/* Artifact + aura */}
      <div className="relative mb-3 grid h-20 w-20 place-items-center">
        <span
          aria-hidden
          className="relic-aura absolute inset-0 rounded-full"
          style={{ background: `radial-gradient(circle, ${color}66, transparent 68%)` }}
        />
        <Icon size={40} style={{ color }} className="relative" aria-hidden />
      </div>
      {/* Pedestal base — lit ledge the artifact rests on */}
      <span
        aria-hidden
        className="relative mb-3 h-2 w-16 rounded-[50%]"
        style={{ background: `${color}55`, boxShadow: `0 6px 14px ${color}55` }}
      />

      <h3 className="relative font-display text-base leading-tight">{relic.name}</h3>
      <div className="relative mt-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider">
        <span style={{ color }}>{relic.rarity}</span>
        <span className="text-white/25">·</span>
        <span className="inline-flex items-center gap-0.5 text-white/55">
          <span aria-hidden>{reactive ? '✦' : '⟳'}</span>{reactive ? 'A innesco' : 'Passiva'}
        </span>
      </div>
      <p className="relative mt-2 text-sm leading-relaxed text-white/75">{relic.desc}</p>
    </Frame>
  )
}

export function RelicNodeScreen({
  offer, owned, team, onPick,
}: {
  offer: Relic[]
  owned: ActiveRelic[]
  team: DraftedWizard[]
  onPick: (relicId: string, assignedTo?: string, replaceRelicId?: string) => void
}) {
  const [pick, setPick] = useState<string | null>(null)
  const [carrier, setCarrier] = useState<string | null>(null)

  const pickedRelic = offer.find(r => r.id === pick)
  const needsCarrier = Boolean(pickedRelic?.assignable)
  const atCap = owned.length >= BALANCE.relics.maxRelics

  return (
    <main className="flex-1 flex flex-col items-center gap-6 p-6">
      <Insegna kicker="Sala dei tesori" title="Scegli una reliquia" />

      {owned.length > 0 && (
        <div className="w-full max-w-4xl">
          <p className="mb-2 text-center text-[10px] uppercase tracking-[0.25em] text-white/45">La tua collezione</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {owned.map(a => <OwnedSigil key={a.relic.id} relic={a.relic} />)}
          </div>
        </div>
      )}

      <Stagger delay={0.15} className="grid max-w-4xl grid-cols-1 gap-6 sm:grid-cols-3">
        {offer.map(r => (
          <StaggerItem key={r.id} className="h-full">
            <Pedestal relic={r} selected={pick === r.id} onSelect={() => { setPick(r.id); setCarrier(null) }} />
          </StaggerItem>
        ))}
      </Stagger>

      {needsCarrier && pick && (
        <div className="w-full max-w-3xl">
          <p className="mb-2 text-center text-[10px] uppercase tracking-[0.25em] text-white/45">Assegna il Marchio a…</p>
          <div className="flex flex-wrap justify-center gap-2">
            {team.map(dw => (
              <button
                key={dw.wizard.id}
                data-testid={`assign-carrier-${dw.wizard.id}`}
                onClick={() => setCarrier(dw.wizard.id)}
                aria-pressed={carrier === dw.wizard.id}
                className="rounded-lg border px-3 py-2 text-sm transition-colors"
                style={{ borderColor: carrier === dw.wizard.id ? '#c084fc' : 'rgba(255,255,255,0.18)', background: carrier === dw.wizard.id ? 'rgba(192,132,252,0.15)' : 'transparent' }}
              >
                {dw.wizard.name} · {dw.stats.hp} PV
              </button>
            ))}
          </div>
          {pickedRelic?.grantsDarkMagic && carrier && (
            <p className="mt-3 text-center text-xs font-semibold text-rose-300">
              ⚠ Diventerà Corrotto — per sempre, non curabile.
            </p>
          )}
        </div>
      )}

      {atCap && pickedRelic && (!needsCarrier || carrier) ? (
        <RelicSwapPanel
          incoming={pickedRelic}
          owned={owned}
          onSwap={(replaceRelicId) => onPick(pickedRelic.id, needsCarrier ? carrier ?? undefined : undefined, replaceRelicId)}
          onReject={() => { setPick(null); setCarrier(null) }}
        />
      ) : (
        <Button variant="primary" disabled={!pick || (needsCarrier && !carrier) || atCap} onClick={() => pick && onPick(pick, needsCarrier ? carrier ?? undefined : undefined)}>Prendi</Button>
      )}

      <style>{`
        @keyframes relicAuraPulse { 0%,100% { opacity: 0.55; transform: scale(1); } 50% { opacity: 0.9; transform: scale(1.08); } }
        .relic-aura { animation: relicAuraPulse 2.4s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .relic-aura { animation: none; } }
      `}</style>
    </main>
  )
}
