import type { ActiveRelic, DraftedWizard } from '@/types'
import type { Keyword } from '@/types/keyword'
import type { RelicRarity } from '@/types/relic'
import { cn } from '@/lib/cn'
import { RELIC_RARITY_COLOR } from '@/lib/relicRarity'
import { isDead } from '@/game/engine/roster'

interface RelicBarProps {
  relics: ActiveRelic[]
  className?: string
  onUse?: (relicId: string) => void
  team?: DraftedWizard[]
}

// Player-facing labels. The stored ids are camelCase build-keywords / kebab rarities;
// these turn them into the words the player reads in the tooltip.
const RARITY_LABEL: Record<RelicRarity, string> = {
  comune: 'Comune',
  'non-comune': 'Non comune',
  rara: 'Rara',
  epica: 'Epica',
}
const KEYWORD_LABEL: Record<Keyword, string> = {
  veleno: 'Veleno',
  colpoFortunato: 'Colpo Fortunato',
  velocita: 'Velocità',
  scudo: 'Scudo',
  controllo: 'Controllo',
  rigenerazione: 'Rigenerazione',
  esecuzione: 'Esecuzione',
  sacrificio: 'Sacrificio',
  magieOscure: 'Magie Oscure',
  evocazione: 'Evocazione',
  crescendo: 'Crescendo',
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
          // `group` + `relative` so the styled tooltip below reveals on hover/focus.
          // The pill is focusable (tabIndex) so keyboard users get the effect too — the
          // native `title` is gone (invisible on touch, unstyled), replaced by this panel.
          <span
            key={relic.id}
            tabIndex={0}
            className="group relative px-2.5 py-1 rounded-full text-xs border bg-white/5 inline-flex items-center gap-1.5 outline-none focus-visible:ring-2 focus-visible:ring-white/30"
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

            {/* Tooltip — opens DOWNWARD, anchored to the left edge of the pill, so it stays
                inside the narrow left sidebar (opening rightward spilled over the map tree
                and got clipped). Shown on hover/focus. A filled header band in the rarity
                colour + a top arrow read faster than the old flat panel. */}
            <span
              role="tooltip"
              className="pointer-events-none absolute left-0 top-full z-[60] mt-2 w-56 max-w-[16rem] overflow-hidden rounded-xl border opacity-0 shadow-2xl transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
              style={{
                background: '#181327',
                borderColor: color,
                boxShadow: `0 0 0 1px ${color}33, 0 18px 44px -12px rgba(0,0,0,0.95)`,
              }}
            >
              {/* top arrow (points back up at the pill) */}
              <span
                aria-hidden
                className="absolute bottom-full left-4 border-[6px] border-transparent"
                style={{ borderBottomColor: color }}
              />
              <span
                className="flex items-center gap-2 px-2.5 py-1.5"
                style={{ background: `color-mix(in srgb, ${color} 20%, #181327)` }}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rotate-45 rounded-[3px]"
                  style={{ background: color, boxShadow: `0 0 8px -1px ${color}` }}
                />
                <span className="min-w-0 flex-1 truncate text-[12px] font-bold text-white">{relic.name}</span>
                <span className="shrink-0 text-[8px] font-extrabold uppercase tracking-wider" style={{ color }}>
                  {RARITY_LABEL[relic.rarity]}
                </span>
              </span>
              <span className="block px-2.5 py-2">
                <span className="block text-[11px] leading-relaxed text-white/75">{relic.desc}</span>
                {relic.keywords && relic.keywords.length > 0 && (
                  <span className="mt-1.5 flex flex-wrap gap-1">
                    {relic.keywords.map(k => (
                      <span
                        key={k}
                        className="rounded-full border px-1.5 py-0.5 text-[8px] uppercase tracking-wide"
                        style={{ color, borderColor: `${color}66` }}
                      >
                        {KEYWORD_LABEL[k]}
                      </span>
                    ))}
                  </span>
                )}
              </span>
            </span>
          </span>
        )
      })}
    </div>
  )
}
