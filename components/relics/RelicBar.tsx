import type { ActiveRelic, DraftedWizard } from '@/types'
import { cn } from '@/lib/cn'
import { RELIC_RARITY_COLOR } from '@/lib/relicRarity'
import { isDead } from '@/game/engine/roster'

interface RelicBarProps {
  relics: ActiveRelic[]
  className?: string
  onUse?: (relicId: string) => void
  team?: DraftedWizard[]
}

export function RelicBar({ relics, className, onUse, team }: RelicBarProps) {
  if (relics.length === 0) {
    return <p className={cn('text-xs text-white/40', className)}>Nessuna reliquia</p>
  }
  const hasDead = team ? team.some(isDead) : false
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {relics.map(({ relic }) => {
        const color = RELIC_RARITY_COLOR[relic.rarity]
        return (
          <span
            key={relic.id}
            title={relic.desc}
            className="px-2.5 py-1 rounded-full text-xs border bg-white/5 inline-flex items-center gap-1.5"
            style={{ borderColor: `${color}55`, color }}
          >
            {relic.name}
            {onUse && relic.active === 'revive' && (
              <button
                onClick={() => hasDead && onUse(relic.id)}
                disabled={!hasDead}
                title={hasDead ? undefined : 'Nessun mago caduto'}
                className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Usa
              </button>
            )}
          </span>
        )
      })}
    </div>
  )
}
