'use client'
import type { DraftedWizard, ActiveSynergy } from '@/types'
import { PortraitImage } from '@/components/ui/PortraitImage'
import { Chip } from '@/components/ui/Chip'
import { houseTheme } from '@/lib/theme'
import { displayName } from '@/lib/displayName'
import { synergyBonusText } from '@/lib/glossary'

function SynergyChip({ s }: { s: ActiveSynergy }) {
  const bonus = synergyBonusText(s.synergy).join(' · ')
  const count = s.memberIds?.length ?? 0
  return (
    <span
      data-synergy={s.synergy.id}
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold"
      style={{ color: '#f3e6c4', borderColor: 'rgba(202,162,74,0.6)', background: 'rgba(176,141,87,0.16)' }}
    >
      <span aria-hidden style={{ color: '#caa24a' }}>✦</span>
      {s.synergy.name.replace(/^\d+\s+/, '')}
      {count > 0 && (
        <span
          className="rounded-full bg-black/30 px-1.5 text-[#e8dcb6]"
          title={`${count} maghi in squadra`}
        >
          ×{count}
        </span>
      )}
      {bonus && <span className="text-[#c9bfa0]">{bonus}</span>}
    </span>
  )
}

/**
 * The current team + active synergies, kept in view across the run screens. Purely
 * presentational — reads the drafted team and the synergies the engine already
 * detected. `orientation` switches between the compact top strip ('horizontal',
 * default) and a left-hand sidebar ('vertical') used next to the map tree, where
 * members get larger portraits so they read better.
 */
export function TeamSynergyBar({
  team, synergies, orientation = 'horizontal',
}: {
  team: DraftedWizard[]
  synergies: ActiveSynergy[]
  orientation?: 'horizontal' | 'vertical'
}) {
  if (orientation === 'vertical') {
    return (
      <div
        data-testid="team-synergy-bar"
        className="flex w-full flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3"
      >
        <div className="flex flex-col gap-2">
          {team.map((m) => {
            const theme = houseTheme(m.wizard.house)
            return (
              <div
                key={m.wizard.id}
                data-house={m.wizard.house}
                className="flex items-center gap-2.5 rounded-xl border bg-black/30 p-1.5"
                style={{ borderColor: `${theme.color}55` }}
              >
                <span className="h-11 w-11 shrink-0 overflow-hidden rounded-lg">
                  <PortraitImage id={m.wizard.id} house={m.wizard.house} alt={m.wizard.name} variant="bust" />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white/90">{displayName(m)}</span>
                <Chip label={`Lv. ${m.level ?? 1}`} color="#F0D98A" />
              </div>
            )
          })}
        </div>

        {synergies.length > 0 && (
          <div className="flex flex-col gap-1.5 border-t border-white/10 pt-2.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">Sinergie attive</span>
            <div className="flex flex-wrap gap-1.5">
              {synergies.map((s) => <SynergyChip key={s.synergy.id} s={s} />)}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      data-testid="team-synergy-bar"
      className="flex w-full flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2"
    >
      {/* Roster — compact portrait + name + level per member. */}
      <div className="flex flex-wrap items-center gap-2">
        {team.map((m) => {
          const theme = houseTheme(m.wizard.house)
          return (
            <div
              key={m.wizard.id}
              data-house={m.wizard.house}
              className="flex items-center gap-2 rounded-xl border bg-black/30 py-1 pl-1 pr-2"
              style={{ borderColor: `${theme.color}55` }}
            >
              <span className="h-7 w-7 shrink-0 overflow-hidden rounded-lg">
                <PortraitImage id={m.wizard.id} house={m.wizard.house} alt={m.wizard.name} variant="bust" />
              </span>
              <span className="truncate text-xs font-semibold text-white/90">{displayName(m)}</span>
              <Chip label={`Lv. ${m.level ?? 1}`} color="#F0D98A" />
            </div>
          )
        })}
      </div>

      {/* Active synergies — gold chips, after the roster. */}
      {synergies.length > 0 && (
        <>
          <span aria-hidden className="mx-0.5 h-5 w-px bg-white/10" />
          <div className="flex flex-wrap items-center gap-1.5">
            {synergies.map((s) => <SynergyChip key={s.synergy.id} s={s} />)}
          </div>
        </>
      )}
    </div>
  )
}
