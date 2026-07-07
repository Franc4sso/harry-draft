'use client'
import type { SynergyProgress, SynergyPreview } from '@/game/engine/synergy'
import { synergyBonusText } from '@/lib/glossary'
import { cn } from '@/lib/cn'

type Row = SynergyProgress | SynergyPreview
function isPreview(r: Row): r is SynergyPreview {
  return 'nextCount' in r
}

// A family's rendered tier node.
type Node = {
  row: Row
  threshold: number
  reached: boolean      // count (or nextCount in preview) has met this tier
  active: boolean       // active in the *current* (pre-pick) state
  activates: boolean    // preview: this pick pushes count over this threshold for the first time
  superseded: boolean   // active but a higher active tier in the same family supersedes it
}
type Group = {
  key: string           // family id, or synergy id for family-less rows
  name: string          // header label (count prefix stripped)
  bonus: string         // top reached/activating tier bonus text
  count: number         // current member count
  nextCount: number     // preview member count (== count outside preview)
  nextThreshold: number // smallest not-yet-reached threshold, or max threshold if all reached
  maxThreshold: number
  nodes: Node[]
}

export function SynergyTracker({
  rows, candidateName,
}: {
  rows: SynergyProgress[] | SynergyPreview[]
  candidateName?: string
}) {
  const relevant = (rows as Row[]).filter((r) => (isPreview(r) ? r.count > 0 || r.advances : r.count > 0))

  // Bucket rows by family (family-less rows are their own single-tier group).
  const buckets = new Map<string, Row[]>()
  for (const r of relevant) {
    const k = r.synergy.family ?? r.synergy.id
    const list = buckets.get(k)
    if (list) list.push(r); else buckets.set(k, [r])
  }

  const groups: Group[] = []
  for (const [key, list] of buckets) {
    const sortedTiers = [...list].sort((a, b) => a.threshold - b.threshold)

    const firstTier = sortedTiers[0]
    if (!firstTier) continue

    const count = firstTier.count
    const nextCount = isPreview(firstTier) ? firstTier.nextCount : count
    // highest active tier in this family (current state) — lower actives are superseded
    let topActive = 0
    for (const r of sortedTiers) if (r.active && r.threshold > topActive) topActive = r.threshold

    const nodes: Node[] = sortedTiers.map((r) => {
      const preview = isPreview(r)
      const reached = (preview ? r.nextCount : r.count) >= r.threshold
      return {
        row: r,
        threshold: r.threshold,
        reached,
        active: r.active,
        activates: preview ? r.willActivate : false,
        superseded: r.active && topActive > r.threshold,
      }
    })

    const notReached = sortedTiers.find((r) => count < r.threshold)
    const maxThreshold = sortedTiers[sortedTiers.length - 1]!.threshold
    // bonus: prefer the top active tier, else the first activating tier, else the first tier
    const topTier = [...sortedTiers].reverse().find((r) => r.active)
      ?? sortedTiers.find((r) => isPreview(r) && r.willActivate)
      ?? firstTier

    groups.push({
      key,
      name: firstTier.synergy.name.replace(/^\d+\s+/, ''),
      bonus: synergyBonusText(topTier.synergy).join(' · '),
      count, nextCount,
      nextThreshold: notReached ? notReached.threshold : maxThreshold,
      maxThreshold,
      nodes,
    })
  }

  // Most built-up families first, then those with an active tier, then closest-to-next.
  groups.sort((a, b) =>
    b.count - a.count ||
    Number(b.nodes.some((n) => n.active)) - Number(a.nodes.some((n) => n.active)) ||
    a.nextThreshold - b.nextThreshold ||
    a.key.localeCompare(b.key))

  return (
    <div className="w-full">
      {/* Engraved gold header — the ledger's masthead. */}
      <div className="mb-1 flex items-center gap-2.5">
        <span aria-hidden className="h-px flex-1" style={{ background: 'linear-gradient(90deg,transparent,rgba(217,182,95,0.45),transparent)' }} />
        <span className="font-display text-[10.5px] uppercase tracking-[0.18em] text-[#d9b65f]">Sinergie</span>
        <span aria-hidden className="h-px flex-1" style={{ background: 'linear-gradient(90deg,transparent,rgba(217,182,95,0.45),transparent)' }} />
      </div>
      <p className="mb-3.5 text-center text-[9px] tracking-[0.05em] text-white/45">
        {candidateName ? <>Se peschi <span className="font-semibold text-[#a8ffbf]">{candidateName}</span></> : 'cosa sbloccano'}
      </p>
      {groups.length === 0 && <p className="text-center text-xs text-white/40">Nessuna sinergia ancora. Pesca per costruirne una.</p>}
      <div className="space-y-3">
        {groups.map((g) => {
          const isActive = g.nodes.some((n) => n.active && !n.superseded)
          const willActivate = g.nodes.some((n) => n.activates)
          const allDone = g.nextCount >= g.maxThreshold
          // One bar to the NEXT tier: "how close am I".
          const prevThreshold = g.nodes.filter((n) => n.threshold < g.nextThreshold).reduce((m, n) => Math.max(m, n.threshold), 0)
          const span = Math.max(1, g.nextThreshold - prevThreshold)
          const ratio = allDone || isActive ? 1 : Math.min(1, Math.max(0, (g.nextCount - prevThreshold) / span))
          // One colour tells the whole story: green = will activate, gold = active, purple = building.
          const col = willActivate ? '#3ecb6a' : isActive ? '#d9b65f' : '#7c3aed'
          const status = willActivate ? '· si attiva' : isActive ? '· attiva' : null
          return (
            <div key={g.key} data-family={g.key}>
              <div className="mb-1.5 flex items-baseline justify-between gap-2">
                <span className="text-[12px] font-semibold text-[#e7e2f2]">
                  {g.name}
                  {status && <span className="ml-1 text-[10px] font-bold" style={{ color: col }}>{status}</span>}
                </span>
                <span className="shrink-0 text-[12px] font-bold tabular-nums" style={{ color: col }}>
                  {g.nextCount}<span className="text-white/30">/{g.nextThreshold}</span>
                </span>
              </div>
              {/* Single progress bar. Per-tier ticks carry the data-* contract but stay subtle. */}
              <div className={cn('relative h-2 w-full overflow-hidden rounded-full bg-white/[0.07]', willActivate && 'synergy-node-pulse')}>
                <span
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{ width: `${ratio * 100}%`, background: col, boxShadow: `0 0 8px ${col}aa` }}
                />
                {g.nodes.map((n) => (
                  <span
                    key={n.threshold}
                    data-synergy={n.row.synergy.id}
                    data-active={n.active ? '' : undefined}
                    data-activates={n.activates ? '' : undefined}
                    data-superseded={n.superseded ? '' : undefined}
                    aria-hidden
                    className="absolute top-1/2 h-2 w-px -translate-y-1/2"
                    style={{ left: `${(n.threshold / g.maxThreshold) * 100}%`, background: 'rgba(0,0,0,0.35)' }}
                  />
                ))}
              </div>
              {g.bonus && <p className="mt-1.5 text-[10px] leading-snug text-white/45">{g.bonus}</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
