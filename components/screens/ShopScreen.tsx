'use client'
import { useState } from 'react'
import type { DraftedWizard } from '@/types'
import type { ShopStock, ShopSlot } from '@/game/engine/resolvers/shop'
import { Button } from '@/components/ui/Button'
import { Frame } from '@/components/ui/Frame'
import { Insegna } from '@/components/ui/Insegna'
import { displayName } from '@/lib/displayName'
import { RELIC_RARITY_COLOR } from '@/lib/relicRarity'

const canAfford = (price: number, wallet: number) => price <= wallet

function Slot({ slot, sold, wallet, team, onBuy }: {
  slot: ShopSlot; sold: boolean; wallet: number; team: DraftedWizard[]
  onBuy: (slotId: string, opts?: { carrierId?: string; targetWizardId?: string }) => void
}) {
  const [pick, setPick] = useState<string | null>(null)
  const affordable = canAfford(slot.price, wallet)
  const needsTarget = slot.kind === 'removeWizard' || (slot.kind === 'relic' && slot.relic?.assignable)
  const teamFull = team.every(d => (d.currentHp ?? d.maxHp) >= d.maxHp)
  const disabled = sold || !affordable || Boolean(needsTarget && !pick) || (slot.kind === 'heal' && teamFull)
  const label = slot.kind === 'relic' ? (slot.relic?.name ?? 'Reliquia')
    : slot.kind === 'heal' ? 'Cura completa' : 'Rimuovi un mago'
  const color = slot.kind === 'relic' && slot.relic ? RELIC_RARITY_COLOR[slot.relic.rarity] : '#9aa3ad'

  return (
    <Frame
      variant="card"
      innerClassName="relative flex h-full flex-col gap-2 p-4"
      style={{ boxShadow: `0 0 16px ${color}22` }}
      data-testid={`shop-slot-${slot.id}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-display text-sm leading-tight">{label}</span>
        <span className="whitespace-nowrap text-xs font-semibold text-[#e8dcb6]">{slot.price} 🍫</span>
      </div>
      {slot.kind === 'relic' && slot.relic && (
        <p className="text-[11px] leading-relaxed text-white/60">{slot.relic.desc}</p>
      )}
      {needsTarget && !sold && (
        <div className="flex flex-wrap gap-1">
          {team.map(d => (
            <button
              key={d.wizard.id}
              type="button"
              aria-pressed={pick === d.wizard.id}
              onClick={() => setPick(d.wizard.id)}
              className={
                'rounded border px-2 py-0.5 text-[11px] ' +
                (pick === d.wizard.id ? 'border-amber-300/70 bg-amber-300/15' : 'border-white/15')
              }
            >
              {displayName(d)}
            </button>
          ))}
        </div>
      )}
      {slot.kind === 'relic' && slot.relic?.grantsDarkMagic && pick && (
        <p className="text-xs font-semibold text-rose-300">
          ⚠ Diventerà Corrotto — per sempre, non curabile.
        </p>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={() =>
          onBuy(
            slot.id,
            slot.kind === 'removeWizard'
              ? { targetWizardId: pick ?? undefined }
              : slot.kind === 'relic' && slot.relic?.assignable
                ? { carrierId: pick ?? undefined }
                : undefined,
          )
        }
        className="mt-auto rounded-lg border border-amber-300/40 bg-amber-300/10 px-2 py-1 text-xs font-semibold text-amber-100 disabled:cursor-default disabled:opacity-40"
      >
        {sold ? 'Esaurito' : 'Compra'}
      </button>
    </Frame>
  )
}

export function ShopScreen({ stock, bought, cioccorane, team, onBuy, onReroll, onLeave }: {
  stock: ShopStock
  bought: string[]
  cioccorane: number
  team: DraftedWizard[]
  onBuy: (slotId: string, opts?: { carrierId?: string; targetWizardId?: string }) => void
  onReroll: () => void
  onLeave: () => void
}) {
  return (
    <main className="flex-1 flex flex-col items-center gap-5 p-6">
      <Insegna kicker="Diagon Alley" title="Negozio" />
      <div className="rounded-full border border-[#caa24a]/40 bg-[#caa24a]/10 px-3 py-1 text-sm font-semibold text-[#e8dcb6]">
        {cioccorane} 🍫
      </div>

      <div className="grid w-full max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">
        {stock.slots.map(slot => (
          <Slot
            key={slot.id}
            slot={slot}
            sold={bought.includes(slot.id)}
            wallet={cioccorane}
            team={team}
            onBuy={onBuy}
          />
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Button variant="ghost" disabled={!canAfford(stock.rerollPrice, cioccorane)} onClick={onReroll}>
          Rimescola ({stock.rerollPrice} 🍫)
        </Button>
        <Button variant="primary" onClick={onLeave}>Esci</Button>
      </div>
    </main>
  )
}
