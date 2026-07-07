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
      <div className="space-y-3.5">
        {groups.map((g) => {
          const fillRatio = Math.min(1, g.maxThreshold <= 0 ? 0 : Math.min(g.nextCount, g.maxThreshold) / g.maxThreshold)
          return (
            <div
              key={g.key}
              data-family={g.key}
              className="[&+&]:border-t [&+&]:border-[#d9b65f]/10 [&+&]:pt-3.5"
            >
              <div className="mb-2.5 flex items-baseline justify-between gap-2">
                <span className="font-display text-[12.5px] font-semibold text-[#f6ecc4]">{g.name}</span>
                <span className="text-[11px] font-bold tabular-nums text-[#d9b65f]">
                  {g.nextCount !== g.count ? <>{g.count} → {g.nextCount}</> : <>{g.count} / {g.nextThreshold}</>}
                </span>
              </div>

              {/* Rune track: etched fill line + gem-socket node per tier threshold. */}
              <div className="relative flex items-center justify-between px-0.5">
                <div aria-hidden className="absolute left-3.5 right-3.5 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-white/10" />
                <div
                  aria-hidden
                  className="synergy-bar-fill absolute left-3.5 top-1/2 h-0.5 -translate-y-1/2 rounded-full"
                  style={{ width: `calc((100% - 1.75rem) * ${fillRatio})`, background: 'linear-gradient(90deg,#7c3aed,#d9b65f)', boxShadow: '0 0 6px rgba(124,58,237,0.5)' }}
                />
                {g.nodes.map((n) => {
                  const green = n.activates
                  const gold = (n.active || n.reached) && !n.superseded
                  const bg = green
                    ? 'linear-gradient(135deg,#a8ffbf,#3ecb6a)'
                    : gold ? 'linear-gradient(135deg,#f6ecc4,#a9802f)' : '#14101f'
                  const ring = green
                    ? '0 0 14px rgba(80,230,130,0.85)'
                    : n.active && !n.superseded ? '0 0 11px rgba(217,182,95,0.6)' : 'none'
                  return (
                    <span
                      key={n.threshold}
                      data-synergy={n.row.synergy.id}
                      data-active={n.active ? '' : undefined}
                      data-activates={n.activates ? '' : undefined}
                      data-superseded={n.superseded ? '' : undefined}
                      className={cn('relative z-10 grid h-[26px] w-[26px] rotate-45 place-items-center rounded-[7px] border-[1.5px]', green && 'synergy-node-pulse')}
                      style={{
                        background: bg,
                        borderColor: green ? '#a8ffbf' : gold ? '#f6ecc4' : '#3a3352',
                        boxShadow: ring,
                        opacity: n.superseded ? 0.5 : 1,
                      }}
                    >
                      <span
                        className="-rotate-45 text-[10.5px] font-extrabold tabular-nums"
                        style={{ color: green ? '#0a2a14' : gold ? '#1a1330' : 'rgba(255,255,255,0.5)' }}
                      >
                        {n.threshold}
                      </span>
                      {n.activates && (
                        <span className="absolute -top-[18px] left-1/2 -translate-x-1/2 -rotate-45 whitespace-nowrap text-[7.5px] font-extrabold uppercase tracking-wide text-[#7ee39a]">
                          si attiva
                        </span>
                      )}
                    </span>
                  )
                })}
              </div>

              {g.bonus && <p className="mt-3 text-[10.5px] leading-snug text-[#c9bfa0]">{g.bonus}</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
