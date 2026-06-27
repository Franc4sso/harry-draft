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
  // Within a family only the highest active tier applies in combat (detectSynergies
  // suppresses the rest). Track each family's highest active threshold so the tracker
  // can mark the lower active tiers as superseded instead of implying they stack.
  const topActiveByFamily = new Map<string, number>()
  for (const r of relevant) {
    if (!r.active || !r.synergy.family) continue
    const cur = topActiveByFamily.get(r.synergy.family) ?? 0
    if (r.threshold > cur) topActiveByFamily.set(r.synergy.family, r.threshold)
  }
  const superseded = (r: SynergyProgress | SynergyPreview) =>
    r.active && !!r.synergy.family && (topActiveByFamily.get(r.synergy.family) ?? 0) > r.threshold

  // Order by how built-up each synergy is: most members first, then active ones,
  // then closest-to-threshold, then id. Sorting on the pre-pick `count` (identical
  // in the current and preview states) keeps rows from swapping places on hover.
  const sorted = [...relevant].sort((a, b) =>
    b.count - a.count ||
    Number(b.active) - Number(a.active) ||
    a.threshold - b.threshold ||
    a.synergy.id.localeCompare(b.synergy.id))

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
          const isSuperseded = superseded(r)
          const shown = preview ? r.nextCount : r.count
          const ratio = Math.min(1, shown / r.threshold)
          const bonus = synergyBonusText(r.synergy.bonus).join(' · ')
          return (
            <div
              key={r.synergy.id}
              data-synergy={r.synergy.id}
              data-active={r.active ? '' : undefined}
              data-activates={activates ? '' : undefined}
              data-superseded={isSuperseded ? '' : undefined}
              className="rounded-lg border p-2"
              style={{
                borderColor: isSuperseded ? '#241f38' : r.active || activates ? '#b08d57' : '#241f38',
                background: isSuperseded ? 'rgba(255,255,255,0.02)' : r.active || activates ? 'rgba(176,141,87,0.12)' : 'rgba(255,255,255,0.02)',
                opacity: isSuperseded ? 0.5 : 1,
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white/90">{r.synergy.name.replace(/^\d+\s+/, '')}</span>
                <span className="text-[11px] font-bold text-[#b08d57]">
                  {preview ? <>{r.count} → {r.nextCount}</> : <>{r.count} / {r.threshold}</>}
                  {activates && <span className="ml-1 text-[#7cdc7c]">SI ATTIVA</span>}
                  {isSuperseded && <span className="ml-1 text-white/40">incluso in tier sup.</span>}
                </span>
              </div>
              <div className="my-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="synergy-bar-fill h-full rounded-full" style={{ width: `${ratio * 100}%`, background: 'linear-gradient(90deg,#7c3aed,#b08d57)' }} />
              </div>
              <p className="text-[10px] text-[#c9bfa0]">{bonus}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
