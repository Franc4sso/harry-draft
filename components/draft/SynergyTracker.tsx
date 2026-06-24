'use client'
import type { SynergyProgress, SynergyPreview } from '@/game/engine/synergy'
import { synergyBonusText } from '@/lib/glossary'

function isPreview(r: SynergyProgress | SynergyPreview): r is SynergyPreview {
  return 'nextCount' in r
}

export function SynergyTracker({
  rows, candidateName,
}: {
  rows: SynergyProgress[] | SynergyPreview[]
  candidateName?: string
}) {
  const relevant = rows.filter((r) => (isPreview(r) ? r.count > 0 || r.advances : r.count > 0))
  const sorted = [...relevant].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1
    return b.count / b.threshold - a.count / a.threshold
  })

  return (
    <div className="w-full">
      <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-white/50">
        {candidateName ? <>Se peschi <span className="text-[#7cdc7c]">{candidateName}</span>:</> : 'Sinergie · cosa sbloccano'}
      </p>
      {sorted.length === 0 && <p className="text-xs text-white/40">Nessuna sinergia ancora. Pesca per costruirne una.</p>}
      <div className="space-y-2">
        {sorted.map((r) => {
          const preview = isPreview(r)
          const activates = preview && r.willActivate
          const shown = preview ? r.nextCount : r.count
          const ratio = Math.min(1, shown / r.threshold)
          const bonus = synergyBonusText(r.synergy.bonus).join(' · ')
          return (
            <div
              key={r.synergy.id}
              data-synergy={r.synergy.id}
              data-active={r.active ? '' : undefined}
              data-activates={activates ? '' : undefined}
              className="rounded-lg border p-2"
              style={{
                borderColor: r.active || activates ? '#b08d57' : '#241f38',
                background: r.active || activates ? 'rgba(176,141,87,0.12)' : 'rgba(255,255,255,0.02)',
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white/90">{r.synergy.name.replace(/^\d+\s+/, '')}</span>
                <span className="text-[11px] font-bold text-[#b08d57]">
                  {preview ? <>{r.count} → {r.nextCount}</> : <>{r.count} / {r.threshold}</>}
                  {activates && <span className="ml-1 text-[#7cdc7c]">SI ATTIVA</span>}
                </span>
              </div>
              <div className="my-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full" style={{ width: `${ratio * 100}%`, background: 'linear-gradient(90deg,#7c3aed,#b08d57)' }} />
              </div>
              <p className="text-[10px] text-[#c9bfa0]">{bonus}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
