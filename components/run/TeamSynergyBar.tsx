'use client'
import type { DraftedWizard, ActiveSynergy } from '@/types'
import { PortraitImage } from '@/components/ui/PortraitImage'
import { Chip } from '@/components/ui/Chip'
import { houseTheme } from '@/lib/theme'
import { displayName } from '@/lib/displayName'
import { synergyBonusText } from '@/lib/glossary'

/**
 * Compact horizontal strip that keeps the current team + active synergies in
 * view across the run screens. Purely presentational — reads the drafted team
 * and the synergies the engine already detected. Mounted persistently in D2.
 */
export function TeamSynergyBar({
  team, synergies,
}: {
  team: DraftedWizard[]
  synergies: ActiveSynergy[]
}) {
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
            {synergies.map((s) => {
              const bonus = s.synergy.bonus ? synergyBonusText(s.synergy.bonus).join(' · ') : ''
              return (
                <span
                  key={s.synergy.id}
                  data-synergy={s.synergy.id}
                  className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold"
                  style={{ color: '#f3e6c4', borderColor: 'rgba(202,162,74,0.6)', background: 'rgba(176,141,87,0.16)' }}
                >
                  <span aria-hidden style={{ color: '#caa24a' }}>✦</span>
                  {s.synergy.name.replace(/^\d+\s+/, '')}
                  {bonus && <span className="text-[#c9bfa0]">{bonus}</span>}
                </span>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
