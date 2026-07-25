'use client'
import { motion, useReducedMotion } from 'framer-motion'
import type { RunNode, RunNodeType } from '@/types'
import { parseAreaNodeId, nodeDepth } from '@/game/engine/map'
import { cn } from '@/lib/theme'
import { Insegna } from '@/components/ui/Insegna'
import { PortraitImage } from '@/components/ui/PortraitImage'
import { RoleIcon } from '@/components/cards/RoleIcon'
import { displayName } from '@/lib/displayName'

/** Floor index for any node id (area-scoped `a#f#n#` or legacy `f#n#`). */
function floorOf(id: string): number {
  try { return parseAreaNodeId(id).floor } catch { return nodeDepth(id) }
}

const ICON: Record<RunNodeType, string> = {
  battle: '⚔️', elite: '☠️', boss: '👑', relic: '💎', event: '❓',
  recruit: '🧙', commonRoom: '🏠', library: '📚', potions: '🧪', forest: '🌲', infirmary: '🏥',
  spellForge: '✨', altare: '🕯️',
}
const LABEL: Record<RunNodeType, string> = {
  battle: 'Battaglia', elite: 'Elite', boss: 'Boss', relic: 'Reliquia', event: 'Evento',
  recruit: 'Recluta', commonRoom: 'Sala Comune', library: 'Biblioteca',
  potions: 'Pozioni', forest: 'Foresta', infirmary: 'Infermeria', spellForge: 'Aumento Magia',
  altare: 'Altare Oscuro',
}
/** Per-type seal accent (ring + glow + ink tint). */
const ACCENT: Record<RunNodeType, string> = {
  battle: '#b08d57', elite: '#e0833a', boss: '#f5c451', relic: '#a78bfa',
  event: '#c78bf0', recruit: '#5fbf8a', commonRoom: '#6fb1c4',
  library: '#6fb1c4', potions: '#5fbf8a', forest: '#5fbf8a', infirmary: '#10b981',
  spellForge: '#5ad1e0', altare: '#8b2f4f',
}

/**
 * Rich hover briefing for a combat node: the exact roster you're about to fight, read
 * straight off the pre-generated `node.battle.enemyTeam` (single source of truth — the
 * live combat re-derives the same package). Portrait · name · role · equipped spell · HP
 * per enemy, plus the enemy level and any telegraphed synergies. Opens to whichever side
 * points inward (`side`) so edge nodes don't push it off-screen. Pointer-events-none so it
 * never blocks the click. Primarily requested for Elite nodes, but every combat node has
 * the data, so all of them get the briefing.
 */
function EnemyPreview({ node, accent, side }: { node: RunNode; accent: string; side: 'left' | 'right' }) {
  const b = node.battle
  if (!b || b.enemyTeam.length === 0) return null
  const enemies = b.enemyTeam
  return (
    <div
      role="tooltip"
      data-testid={`enemy-preview-${node.id}`}
      className={cn(
        'pointer-events-none absolute top-1/2 z-[60] w-56 -translate-y-1/2 rounded-xl border p-2.5 text-left opacity-0 shadow-2xl transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100',
        side === 'left' ? 'right-full mr-3' : 'left-full ml-3',
      )}
      style={{ background: '#14101f', borderColor: `${accent}66`, boxShadow: `0 0 0 1px ${accent}33, 0 18px 44px -10px rgba(0,0,0,0.95)` }}
    >
      <div className="mb-2 flex items-center justify-between gap-2 border-b border-white/10 pb-1.5">
        <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: accent }}>{LABEL[node.type]}</span>
        <span className="shrink-0 rounded-full bg-white/10 px-1.5 text-[10px] font-semibold text-white/70">
          {enemies.length} nemic{enemies.length === 1 ? 'o' : 'i'} · Lv {b.enemyLevel}
        </span>
      </div>
      <ul className="flex flex-col gap-1">
        {enemies.map((e, i) => (
          <li key={`${e.wizard.id}-${i}`} className="flex items-center gap-2">
            <span className="h-7 w-7 shrink-0 overflow-hidden rounded-md ring-1 ring-white/10">
              <PortraitImage id={e.wizard.id} house={e.wizard.house} alt={e.wizard.name} variant="bust" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1">
                <span className="truncate text-[11px] font-semibold text-white/90">{displayName(e)}</span>
                {e.wizard.role && <RoleIcon role={e.wizard.role} size={9} className="shrink-0 text-white/50" />}
              </span>
              <span className="block truncate text-[9px] text-white/45">{e.spell?.name ?? '—'}</span>
            </span>
            <span className="shrink-0 text-right text-[10px] font-semibold tabular-nums text-white/60">{e.maxHp}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// Layout grid: each floor is a row (entry at the bottom, boss at the top).
const COL = 168, ROW = 148, NODE = 60, BOSS = 80
// Headroom above the top floor so the boss node's above-node telegraph label
// (`bottom-full`, always visible) doesn't overflow into the header title.
const TOP_PAD = 44

export function MapScreen({
  map, currentNodeId, reachableIds, onChoose, area, areasTotal, noRecruits,
}: {
  map: RunNode[]
  currentNodeId: string
  reachableIds: string[]
  onChoose: (nodeId: string) => void
  area?: number
  areasTotal?: number
  /** P5 — Voto Infrangibile (Patto): recruit nodes stay walkable (the resolver just
   *  no-ops the pick, see recruitResolver), but they must LOOK dead — barred + a
   *  reason — so the player doesn't wander in expecting a live recruit offer. */
  noRecruits?: boolean
}) {
  const reduce = useReducedMotion()
  const reachable = new Set(reachableIds)
  // Endless mode passes no `areasTotal` (the run is infinite): show `∞` for the total
  // rather than the old `?? 1` fallback, which rendered a nonsensical "Area 3 / 1".
  // Mirrors AreaClearedScreen's undefined-total → ∞ convention.
  const header = (
    <Insegna
      kicker={`Area ${(area ?? 0) + 1} / ${areasTotal !== undefined ? areasTotal : '∞'}`}
      title="Scegli il cammino"
    />
  )

  // Defensive: with no nodes there is nothing to wire (and the geometry below
  // would compute a non-finite height). Show just the header.
  if (map.length === 0) {
    return <div className="flex-1 flex flex-col items-center gap-5 p-6">{header}</div>
  }

  const maxFloor = Math.max(...map.map(n => floorOf(n.id)))
  const floors = Array.from({ length: maxFloor + 1 }, (_, f) => map.filter(n => floorOf(n.id) === f))
  const maxW = Math.max(1, ...floors.map(fl => fl.length))
  const width = maxW * COL
  const height = (maxFloor + 1) * ROW + TOP_PAD

  // Node centres: x spread evenly across the floor, y by floor (floor 0 at the bottom).
  const pos = new Map<string, { x: number; y: number }>()
  floors.forEach((nodes, f) => {
    nodes.forEach((n, i) => {
      pos.set(n.id, { x: (width * (i + 1)) / (nodes.length + 1), y: (maxFloor - f) * ROW + ROW / 2 + TOP_PAD })
    })
  })

  // Ink trails f -> f+1. The trail leaving the current node toward a reachable
  // node is the live one (gold, flowing); every other trail is a faint memory.
  const edges: { id: string; p: { x: number; y: number }; q: { x: number; y: number }; active: boolean }[] = []
  for (const n of map) {
    const p = pos.get(n.id)
    if (!p) continue
    for (const nx of n.next ?? []) {
      const q = pos.get(nx)
      if (!q) continue
      edges.push({ id: `${n.id}->${nx}`, p, q, active: n.id === currentNodeId && reachable.has(nx) })
    }
  }

  const bossAccent = ACCENT.boss

  return (
    <div
      className="relative flex-1 flex flex-col items-center gap-5 overflow-auto p-6 pb-16 [scrollbar-gutter:stable]"
      style={{ background: 'radial-gradient(130% 80% at 50% -12%, #1b1436 0%, #100c20 52%, #09070f 100%)' }}
    >
      {header}

      <div className="relative" style={{ width, height }}>
        {/* Atmosphere: the ascent reads as a climb toward a lit summit where the boss waits.
            A warm beacon glows behind the top floor; a cold vignette settles over the base. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="absolute left-1/2 top-0 h-72 w-[150%] -translate-x-1/2"
            style={{ background: `radial-gradient(58% 100% at 50% 0%, ${bossAccent}2b, transparent 72%)` }}
          />
          <div
            className="absolute inset-x-0 bottom-0 h-1/2"
            style={{ background: 'linear-gradient(0deg, rgba(6,4,12,0.6), transparent)' }}
          />
        </div>
        <svg
          className="pointer-events-none absolute inset-0"
          width={width} height={height} viewBox={`0 0 ${width} ${height}`}
          fill="none" aria-hidden
        >
          {edges.map(e => {
            const midY = (e.p.y + e.q.y) / 2
            const d = `M ${e.p.x} ${e.p.y} C ${e.p.x} ${midY}, ${e.q.x} ${midY}, ${e.q.x} ${e.q.y}`
            if (e.active) {
              // The live trail: one static wide glow twin (no animation, no blur) +
              // ONE main stroke that draws once via pathLength + an optional
              // travelling light (SMIL animateMotion, independent of the stroke).
              // Keeping these three layers separate avoids the flicker caused by
              // running framer-motion's pathLength and a CSS dash-offset loop on
              // the same path.
              return (
                <g key={e.id}>
                  <path aria-hidden d={d} stroke="rgba(7,5,14,0.55)" strokeWidth={6} strokeLinecap="round" />
                  <path
                    data-edge-glow
                    aria-hidden
                    d={d}
                    stroke="rgba(202,162,74,0.24)"
                    strokeWidth={8}
                    strokeLinecap="round"
                  />
                  <motion.path
                    data-live-edge
                    d={d}
                    stroke="var(--gold-2)"
                    strokeWidth={3.5}
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
                  />
                  {!reduce && (
                    <circle r={3} fill="#f6e6a8">
                      <animateMotion dur="1.8s" repeatCount="indefinite" path={d} />
                    </circle>
                  )}
                </g>
              )
            }
            // Dormant trails: a dark contrast halo under a clean solid warm line, so every
            // connection is unmistakably readable over both the lit summit and the dark base
            // (the earlier faint dotted version was hard to follow).
            return (
              <g key={e.id}>
                <path d={d} stroke="rgba(7,5,14,0.6)" strokeWidth={5} strokeLinecap="round" />
                <path d={d} stroke="rgba(233,219,180,0.34)" strokeWidth={2} strokeLinecap="round" />
              </g>
            )
          })}
        </svg>

        {map.map(n => {
          const p = pos.get(n.id)
          if (!p) return null
          const isCurrent = n.id === currentNodeId
          const isReachable = reachable.has(n.id)
          const isBoss = n.type === 'boss'
          const sz = isBoss ? BOSS : NODE
          const accent = ACCENT[n.type]
          const lit = isReachable || isCurrent
          // P5 — Voto Infrangibile: a recruit node stays technically walkable (the resolver
          // no-ops the pick), but must LOOK dead so the player doesn't expect a live offer.
          const blocked = Boolean(noRecruits) && n.type === 'recruit'
          return (
            <button
              key={n.id}
              data-testid={`node-${n.id}`}
              data-blocked={blocked || undefined}
              disabled={!isReachable}
              onClick={() => onChoose(n.id)}
              aria-label={LABEL[n.type]}
              className={cn(
                // hover/focus lifts the whole seal above its neighbours so its briefing card
                // (which overflows the seal) is never painted under a later node. Needed
                // because reachable seals carry a constant transform (breathe) that would
                // otherwise trap the card inside their stacking context.
                'group absolute z-10 flex items-center justify-center rounded-full border-4 transition-all duration-200 hover:z-50 focus-visible:z-50',
                isReachable ? 'cursor-pointer hover:scale-110 focus-visible:scale-110' : 'cursor-not-allowed',
                isReachable && !isCurrent && !blocked && 'anim-ambient map-breathe',
                // Dim used/distant seals with brightness+saturation, NOT opacity — the fill
                // stays fully opaque so the trails behind can never show through the circle.
                n.resolved && 'saturate-[.5] brightness-[.62]',
                !lit && !n.resolved && 'saturate-[.8] brightness-[.72]',
                blocked && 'saturate-[.35] brightness-[.6]',
                isCurrent && 'map-current',
              )}
              style={{
                left: p.x - sz / 2, top: p.y - sz / 2, width: sz, height: sz,
                borderColor: blocked ? '#e0464688' : lit ? accent : 'rgba(255,255,255,0.18)',
                // Opaque solid base (#17122a) UNDER the decorative gradients so the seal reads
                // as a filled coin, not a translucent ring.
                background: `radial-gradient(circle at 50% 28%, rgba(255,255,255,0.14), transparent 46%), radial-gradient(circle at 50% 40%, ${accent}40, transparent 72%), #17122a`,
                boxShadow: isCurrent
                  ? `0 2px 0 rgba(255,255,255,0.22) inset, inset 0 0 0 2.5px rgba(10,8,19,0.85), inset 0 0 0 3.5px ${accent}66, 0 0 0 3px ${accent}55, 0 0 26px ${accent}aa, 0 10px 24px -10px rgba(0,0,0,0.8)`
                  : isReachable
                    ? `0 2px 0 rgba(255,255,255,0.18) inset, inset 0 0 0 2.5px rgba(10,8,19,0.85), inset 0 0 0 3.5px ${accent}55, 0 0 16px ${accent}66, 0 10px 24px -10px rgba(0,0,0,0.8)`
                    : `inset 0 0 0 2.5px rgba(10,8,19,0.7), 0 6px 18px -10px rgba(0,0,0,0.7)`,
              }}
            >
              {/* Grounding shadow: seals read as resting on the path, not floating. */}
              <span
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-[92%] h-2.5 w-[74%] -translate-x-1/2 rounded-[50%]"
                style={{ background: 'radial-gradient(closest-side, rgba(0,0,0,0.5), transparent)' }}
              />
              {isBoss && n.preview?.bossFace ? (
                // Boss seal wears the villain's own face — a medallion, not a crown glyph.
                <span className="absolute inset-0 overflow-hidden rounded-full">
                  <PortraitImage
                    id={n.preview.bossFace.id}
                    house={n.preview.bossFace.house}
                    alt={n.preview.bossName ?? 'Boss'}
                    variant="bust"
                  />
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 rounded-full"
                    style={{ boxShadow: `inset 0 0 0 2px ${accent}77, inset 0 -14px 20px -8px ${accent}66`, background: 'radial-gradient(120% 80% at 50% 8%, transparent 55%, rgba(6,4,12,0.55))' }}
                  />
                </span>
              ) : (
                <span
                  className={cn('emboss leading-none', isBoss ? 'text-3xl' : 'text-xl')}
                  style={lit ? { filter: `drop-shadow(0 0 6px ${accent}88)` } : undefined}
                >
                  {ICON[n.type]}
                </span>
              )}
              {blocked && (
                // Barred glyph: a diagonal strike over the recruit icon so the seal reads
                // "dead" at a glance, without fully disabling the node (it stays walkable
                // so the player can reach RecruitScreen's blocked-reason message).
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-2 rounded-full"
                  style={{ background: 'linear-gradient(45deg, transparent 46%, #e04646aa 49%, #e04646aa 51%, transparent 54%)' }}
                />
              )}
              <span className="pointer-events-none absolute top-full mt-1 whitespace-nowrap rounded-md border border-white/15 bg-[#15121f]/95 px-2 py-0.5 text-[10px] text-white/85 opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
                {LABEL[n.type]}
              </span>
              {blocked && (
                <span
                  data-testid={`node-${n.id}-reason`}
                  className="pointer-events-none absolute top-full mt-6 w-40 whitespace-normal rounded-md border border-rose-400/40 bg-[#15121f]/95 px-2 py-1 text-center text-[9px] text-rose-200 opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
                >
                  Il Voto Infrangibile è stato giurato — niente più reclute.
                </span>
              )}
              {n.preview?.bossName && (
                // Boss name is the only always-on telegraph. Synergies are no longer shown
                // here or in the hover card (user directive) — the hover roster is the whole
                // enemy briefing now.
                <span
                  data-testid={`telegraph-${n.id}`}
                  className="pointer-events-none absolute bottom-full mb-1 flex max-w-[140px] flex-wrap justify-center gap-0.5"
                >
                  <span className="group/hint relative rounded-full border px-1.5 py-0.5 text-[8px] font-bold"
                    style={{ color: '#f5c451', borderColor: 'rgba(245,196,81,0.6)', background: 'rgba(245,196,81,0.16)' }}
                    tabIndex={n.preview.bossHint ? 0 : undefined}
                  >
                    {n.preview.bossName}
                    {n.preview.bossHint && (
                      <span className="pointer-events-none absolute bottom-full left-1/2 mb-1 w-max max-w-[160px] -translate-x-1/2 whitespace-normal rounded-md border border-white/15 bg-[#15121f]/95 px-2 py-1 text-[9px] font-normal normal-case text-white/85 opacity-0 shadow-lg transition-opacity duration-150 group-hover/hint:opacity-100 group-focus-visible/hint:opacity-100">
                        {n.preview.bossHint}
                      </span>
                    )}
                  </span>
                </span>
              )}
              {n.resolved && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute -bottom-1 -right-1 grid h-4 w-4 place-items-center rounded-full bg-[#15121f] text-[9px] font-bold leading-none text-emerald-300 ring-1 ring-emerald-400/40"
                >
                  ✓
                </span>
              )}
              <EnemyPreview node={n} accent={accent} side={p.x > width / 2 ? 'left' : 'right'} />
            </button>
          )
        })}
      </div>

      <style>{`
        @keyframes mapCurrentPulse { 0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.06); opacity: 0.9; } }
        .map-current { animation: mapCurrentPulse 1.8s ease-in-out infinite; }
        @keyframes mapBreathe { 0%,100% { transform: scale(1); } 50% { transform: scale(1.06); } }
        .map-breathe { animation: mapBreathe 2.6s ease-in-out infinite; }
        .map-breathe:hover, .map-breathe:focus-visible { animation: none; }
        @media (prefers-reduced-motion: reduce) { .map-current, .map-breathe { animation: none; } }
      `}</style>
    </div>
  )
}
