import type { ActiveRelic } from '@/types'
import { cn } from '@/lib/cn'
import { RELIC_RARITY_COLOR } from '@/lib/relicRarity'

export function RelicBar({ relics, className }: { relics: ActiveRelic[]; className?: string }) {
  if (relics.length === 0) {
    return <p className={cn('text-xs text-white/40', className)}>Nessuna reliquia</p>
  }
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {relics.map(({ relic }) => {
        const color = RELIC_RARITY_COLOR[relic.rarity]
        return (
          <span
            key={relic.id}
            title={relic.desc}
            className="px-2.5 py-1 rounded-full text-xs border bg-white/5"
            style={{ borderColor: `${color}55`, color }}
          >
            {relic.name}
          </span>
        )
      })}
    </div>
  )
}
