'use client'
import type { ActiveSynergy, ActiveRelic } from '@/types'
import { synergyBonusText } from '@/lib/glossary'
import { cn } from '@/lib/theme'

/**
 * The active-buffs ribbon shown above a team in battle: each active synergy as
 * a gold pill (name + short bonus), plus the player's relics. Enemy teams pass
 * no relics (engine invariant: only the player carries relics). Purely
 * presentational — reads what the engine already applied.
 */
export function SynergyRibbon({
  synergies, relics = [], align = 'left', title, tone = 'ally',
}: {
  synergies: ActiveSynergy[]
  relics?: ActiveRelic[]
  align?: 'left' | 'right'
  title?: string
  tone?: 'ally' | 'enemy'
}) {
  if (synergies.length === 0 && relics.length === 0 && !title) return null
  const accent = tone === 'enemy' ? 'border-rose-400/40 text-rose-200/80' : 'border-emerald-400/40 text-emerald-200/80'
  return (
    <div
      data-testid="synergy-ribbon"
      data-tone={tone}
      className={cn('flex flex-col gap-1 rounded-lg border px-2 py-1.5', accent, align === 'right' ? 'items-end' : 'items-start')}
    >
      {title && <span className="text-[9px] uppercase tracking-widest opacity-80">{title}</span>}
      <div className={cn('flex flex-wrap items-center gap-1', align === 'right' ? 'justify-end' : 'justify-start')}>
        {synergies.map((s) => (
          <span
            key={s.synergy.id}
            data-synergy={s.synergy.id}
            className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold"
            style={{ color: '#f3e6c4', borderColor: 'rgba(202,162,74,0.6)', background: 'rgba(176,141,87,0.16)' }}
          >
            <span aria-hidden style={{ color: '#caa24a' }}>✦</span>
            {s.synergy.name}
            <span className="text-[#c9bfa0]">{synergyBonusText(s.synergy.bonus).join(' · ')}</span>
          </span>
        ))}
        {relics.map((r) => (
          <span
            key={r.relic.id}
            data-relic={r.relic.id}
            className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold"
            style={{ color: '#d6c8ff', borderColor: 'rgba(124,58,237,0.5)', background: 'rgba(124,58,237,0.16)' }}
          >
            <span aria-hidden style={{ color: '#a855f7' }}>◈</span>
            {r.relic.name}
          </span>
        ))}
      </div>
    </div>
  )
}
