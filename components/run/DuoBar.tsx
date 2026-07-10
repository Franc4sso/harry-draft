'use client'
import type { ActiveRelic, DraftedWizard } from '@/types'
import { duoProgress } from '@/game/engine/duos'
import { SIGNAL_LABEL } from '@/data/duos'

// Same accent language as SynergyTracker (draft/SynergyTracker.tsx:119-121): gold = active,
// green = one signal away. No third (purple/"building") tier here — a Duo panel only ever
// cares about "lit now" vs "almost".
const GOLD = '#d9b65f'
const GREEN = '#3ecb6a'

/**
 * In-run Duo panel: which Duos are ACTIVE (both signals lit — the effect is live this
 * battle) and which are NEAR (exactly one signal short — "manca: <Segnale>"). Purely
 * presentational over `duoProgress`; mounted inside TeamSynergyBar's vertical sidebar.
 */
export function DuoBar({ team, relics }: { team: DraftedWizard[]; relics: ActiveRelic[] }) {
  const progress = duoProgress(team, relics)
  const active = progress.filter((p) => p.active)
  const near = progress.filter((p) => !p.active && p.missing.length === 1)

  if (active.length === 0 && near.length === 0) return null

  return (
    <div className="flex flex-col gap-1.5 border-t border-white/10 pt-2.5" data-testid="duo-bar">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">Duo</span>
        {active.length > 0 && (
          <span className="rounded-full bg-[#caa24a]/20 px-1.5 text-[10px] font-semibold text-[#e8dcb6]">{active.length}</span>
        )}
      </div>
      <ul className="flex flex-col gap-1.5">
        {active.map((p) => (
          <li
            key={p.duo.id}
            data-duo={p.duo.id}
            data-active
            className="rounded-lg border px-2 py-1.5"
            style={{ borderColor: `${GOLD}66`, background: `${GOLD}1f` }}
          >
            <p className="text-[13px] font-semibold leading-tight" style={{ color: '#f3e6c4' }}>{p.duo.name}</p>
            <p className="mt-0.5 text-[11px] leading-snug text-[#c9bfa0]">{p.duo.desc}</p>
          </li>
        ))}
        {near.map((p) => (
          <li
            key={p.duo.id}
            data-duo={p.duo.id}
            data-near
            className="rounded-lg border border-dashed px-2 py-1.5"
            style={{ borderColor: `${GREEN}55` }}
          >
            <p className="text-[11px] font-semibold leading-tight" style={{ color: GREEN }}>
              {p.duo.name}
              <span className="ml-1 font-normal text-white/45">— manca: {SIGNAL_LABEL[p.missing[0]!]}</span>
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}
