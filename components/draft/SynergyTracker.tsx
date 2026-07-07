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
      <div className="space-y-2.5">
        {groups.map((g) => {
          // Overall family state, so the block reads at a glance.
          const isActive = g.nodes.some((n) => n.active && !n.superseded)
          const willActivate = g.nodes.some((n) => n.activates)
          const missing = Math.max(0, g.nextThreshold - g.nextCount) // members still needed for the next tier
          const allDone = g.nextCount >= g.maxThreshold
          // Accent + status colour: green if a pick would activate it, gold if already active, muted otherwise.
          const accent = willActivate ? '#3ecb6a' : isActive ? '#d9b65f' : '#5b5470'
          const statusText = willActivate ? 'Si attiva' : isActive ? 'Attiva' : allDone ? 'Completa' : `Manca ${missing}`
          const statusFg = willActivate ? '#0a2a14' : isActive ? '#1a1330' : '#cdc7dd'
          const statusBg = willActivate ? '#7ee39a' : isActive ? '#d9b65f' : 'rgba(255,255,255,0.06)'
          // progress toward the NEXT tier (clear "how close am I"), not toward max.
          const prevThreshold = g.nodes.filter((n) => n.threshold < g.nextThreshold).reduce((m, n) => Math.max(m, n.threshold), 0)
          const span = Math.max(1, g.nextThreshold - prevThreshold)
          const stepRatio = allDone ? 1 : Math.min(1, Math.max(0, (g.nextCount - prevThreshold) / span))
          return (
            <div
              key={g.key}
              data-family={g.key}
              className="relative overflow-hidden rounded-xl border py-2.5 pl-3.5 pr-3"
              style={{
                borderColor: willActivate ? 'rgba(126,227,154,0.5)' : isActive ? 'rgba(217,182,95,0.4)' : 'rgba(255,255,255,0.08)',
                background: willActivate ? 'rgba(62,203,106,0.08)' : isActive ? 'rgba(217,182,95,0.07)' : 'rgba(255,255,255,0.02)',
              }}
            >
              {/* left accent stripe — instantly distinguishes each synergy */}
              <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: accent, boxShadow: `0 0 8px ${accent}` }} />

              <div className="flex items-center justify-between gap-2">
                <span className="font-display text-[13px] font-semibold text-[#f6ecc4]">{g.name}</span>
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide tabular-nums"
                  style={{ background: statusBg, color: statusFg }}
                >
                  {statusText}
                </span>
              </div>

              {/* Big legible count + tier gem row */}
              <div className="mt-2 flex items-center gap-2.5">
                <span className="shrink-0 text-[15px] font-extrabold tabular-nums text-white">
                  {g.nextCount}<span className="text-white/35">/{g.nextThreshold}</span>
                </span>
                {/* segmented tier gems — solid when reached, ring on current target */}
                <div className="relative flex flex-1 items-center gap-1.5">
                  {g.nodes.map((n) => {
                    const green = n.activates
                    const gold = (n.active || n.reached) && !n.superseded
                    const isTarget = !gold && !green && n.threshold === g.nextThreshold
                    return (
                      <div
                        key={n.threshold}
                        data-synergy={n.row.synergy.id}
                        data-active={n.active ? '' : undefined}
                        data-activates={n.activates ? '' : undefined}
                        data-superseded={n.superseded ? '' : undefined}
                        className={cn('flex flex-1 items-center gap-1.5', green && 'synergy-node-pulse')}
                        style={{ opacity: n.superseded ? 0.45 : 1 }}
                      >
                        {/* track segment fills toward this node */}
                        <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                          <span
                            className="absolute inset-y-0 left-0 rounded-full"
                            style={{
                              width: gold || green ? '100%' : isTarget ? `${stepRatio * 100}%` : '0%',
                              background: green ? '#3ecb6a' : gold ? 'linear-gradient(90deg,#a9802f,#f6ecc4)' : '#7c3aed',
                            }}
                          />
                        </span>
                        {/* tier gem */}
                        <span
                          className="grid h-5 w-5 shrink-0 rotate-45 place-items-center rounded-[5px] border"
                          style={{
                            background: green ? 'linear-gradient(135deg,#a8ffbf,#3ecb6a)' : gold ? 'linear-gradient(135deg,#f6ecc4,#a9802f)' : '#14101f',
                            borderColor: green ? '#a8ffbf' : gold ? '#f6ecc4' : isTarget ? accent : '#3a3352',
                            boxShadow: green ? '0 0 12px rgba(80,230,130,0.85)' : gold ? '0 0 8px rgba(217,182,95,0.5)' : 'none',
                          }}
                        >
                          <span
                            className="-rotate-45 text-[9px] font-extrabold tabular-nums"
                            style={{ color: green ? '#0a2a14' : gold ? '#1a1330' : isTarget ? '#e7e2f2' : 'rgba(255,255,255,0.45)' }}
                          >
                            {n.threshold}
                          </span>
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {g.bonus && <p className="mt-2 text-[10.5px] leading-snug text-[#c9bfa0]">{g.bonus}</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
