'use client'
import type { ActiveRelic, Relic } from '@/types'
import { Button } from '@/components/ui/Button'
import { RELIC_RARITY_COLOR } from '@/lib/relicRarity'

/** Shown when the player is at the relic cap (`BALANCE.relics.maxRelics`) and picks
 *  a new relic: forces an explicit choice — swap it for one of the `owned` relics
 *  (pastiglie, same rarity-tinted pill style as {@link RelicBar}) or reject the
 *  offer outright. Generic/pure — reused by the Shop and Altare Oscuro nodes. */
export function RelicSwapPanel({
  incoming, owned, onSwap, onReject,
}: {
  incoming: Relic
  owned: ActiveRelic[]
  onSwap: (replaceRelicId: string) => void
  onReject: () => void
}) {
  return (
    <div className="w-full max-w-3xl">
      <p className="mb-2 text-center text-[10px] uppercase tracking-[0.25em] text-white/45">
        Collezione piena — scarta una reliquia per prendere {incoming.name}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {owned.map(({ relic }) => {
          const color = RELIC_RARITY_COLOR[relic.rarity]
          return (
            <button
              key={relic.id}
              type="button"
              data-testid={`swap-${relic.id}`}
              onClick={() => onSwap(relic.id)}
              className="px-2.5 py-1 rounded-full text-xs border bg-white/5 transition-colors hover:bg-white/10"
              style={{ borderColor: `${color}55`, color }}
            >
              {relic.name}
            </button>
          )
        })}
      </div>
      <div className="mt-4 flex justify-center">
        <Button variant="ghost" data-testid="relic-reject" onClick={onReject}>Rifiuta</Button>
      </div>
    </div>
  )
}
