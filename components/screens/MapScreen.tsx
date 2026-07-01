'use client'
import type { RunNode, RunNodeType } from '@/types'
import { parseAreaNodeId, nodeDepth } from '@/game/engine/map'
import { cn } from '@/lib/theme'
import { synergyName } from '@/lib/synergyBadge'

/** Floor index for any node id (area-scoped `a#f#n#` or legacy `f#n#`). */
function floorOf(id: string): number {
  try { return parseAreaNodeId(id).floor } catch { return nodeDepth(id) }
}

const ICON: Record<RunNodeType, string> = {
  battle: '⚔️', elite: '☠️', boss: '👑', relic: '💎', event: '❓', shop: '🛒',
  recruit: '🧙', commonRoom: '🏠', library: '📚', potions: '🧪', forest: '🌲', infirmary: '🏥',
}
const LABEL: Record<RunNodeType, string> = {
  battle: 'Battaglia', elite: 'Elite', boss: 'Boss', relic: 'Reliquia', event: 'Evento',
  shop: 'Negozio', recruit: 'Recluta', commonRoom: 'Sala Comune', library: 'Biblioteca',
  potions: 'Pozioni', forest: 'Foresta', infirmary: 'Infermeria',
}
/** Per-type seal accent (ring + glow + ink tint). */
const ACCENT: Record<RunNodeType, string> = {
  battle: '#b08d57', elite: '#e0833a', boss: '#f5c451', relic: '#a78bfa',
  event: '#c78bf0', shop: '#e6b450', recruit: '#5fbf8a', commonRoom: '#6fb1c4',
  library: '#6fb1c4', potions: '#5fbf8a', forest: '#5fbf8a', infirmary: '#10b981',
}

// Layout grid: each floor is a row (entry at the bottom, boss at the top).
const COL = 132, ROW = 116, NODE = 60, BOSS = 80

export function MapScreen({
  map, currentNodeId, reachableIds, onChoose, area, areasTotal,
}: {
  map: RunNode[]
  currentNodeId: string
  reachableIds: string[]
  onChoose: (nodeId: string) => void
  area?: number
  areasTotal?: number
}) {
  const reachable = new Set(reachableIds)
  const header = (
    <div className="text-center">
      {area !== undefined && (
        <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-gold/80">
          Area {area + 1}{areasTotal ? ` / ${areasTotal}` : ''}
        </div>
      )}
      <h2 className="mt-1 text-2xl font-bold text-white/90">Scegli il tuo cammino</h2>
    </div>
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
  const height = (maxFloor + 1) * ROW

  // Node centres: x spread evenly across the floor, y by floor (floor 0 at the bottom).
  const pos = new Map<string, { x: number; y: number }>()
  floors.forEach((nodes, f) => {
    nodes.forEach((n, i) => {
      pos.set(n.id, { x: (width * (i + 1)) / (nodes.length + 1), y: (maxFloor - f) * ROW + ROW / 2 })
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

  return (
    <div className="flex-1 flex flex-col items-center gap-5 overflow-auto p-6">
      {header}

      <div className="relative" style={{ width, height }}>
        <svg
          className="pointer-events-none absolute inset-0"
          width={width} height={height} viewBox={`0 0 ${width} ${height}`}
          fill="none" aria-hidden
        >
          {edges.map(e => {
            const midY = (e.p.y + e.q.y) / 2
            const d = `M ${e.p.x} ${e.p.y} C ${e.p.x} ${midY}, ${e.q.x} ${midY}, ${e.q.x} ${e.q.y}`
            return (
              <path
                key={e.id} d={d}
                stroke={e.active ? 'var(--gold)' : 'rgba(255,255,255,0.12)'}
                strokeWidth={e.active ? 2.5 : 1.5}
                strokeLinecap="round"
                strokeDasharray={e.active ? '5 7' : undefined}
                className={e.active ? 'map-trail' : undefined}
              />
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
          return (
            <button
              key={n.id}
              data-testid={`node-${n.id}`}
              disabled={!isReachable}
              onClick={() => onChoose(n.id)}
              aria-label={LABEL[n.type]}
              className={cn(
                'group absolute flex items-center justify-center rounded-full border-2 transition-all duration-200',
                isReachable ? 'cursor-pointer hover:scale-110 focus-visible:scale-110' : 'cursor-not-allowed',
                n.resolved && 'opacity-45 saturate-50',
                !lit && !n.resolved && 'opacity-55',
                isCurrent && 'map-current',
              )}
              style={{
                left: p.x - sz / 2, top: p.y - sz / 2, width: sz, height: sz,
                borderColor: lit ? accent : 'rgba(255,255,255,0.18)',
                background: `radial-gradient(circle at 50% 35%, ${accent}22, #15121f 72%)`,
                boxShadow: isCurrent
                  ? `0 0 0 3px ${accent}55, 0 0 22px ${accent}aa`
                  : isReachable ? `0 0 14px ${accent}66` : 'none',
              }}
            >
              <span className={cn('leading-none', isBoss ? 'text-3xl' : 'text-xl')}>{ICON[n.type]}</span>
              <span className="pointer-events-none absolute top-full mt-1 whitespace-nowrap rounded-md border border-white/15 bg-[#15121f]/95 px-2 py-0.5 text-[10px] text-white/85 opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
                {LABEL[n.type]}
              </span>
              {n.preview && (n.preview.synergyIds.length > 0 || n.preview.bossName || n.preview.bossHint) && (
                <span
                  data-testid={`telegraph-${n.id}`}
                  className="pointer-events-none absolute bottom-full mb-1 flex max-w-[120px] flex-wrap justify-center gap-0.5"
                >
                  {n.preview.bossName && (
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
                  )}
                  {n.preview.synergyIds.map(sid => (
                    <span key={sid} data-synergy={sid}
                      className="rounded-full border px-1.5 py-0.5 text-[8px] font-semibold"
                      style={{ color: '#f3e6c4', borderColor: 'rgba(202,162,74,0.6)', background: 'rgba(176,141,87,0.16)' }}>
                      {synergyName(sid)}
                    </span>
                  ))}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <style>{`
        @keyframes mapTrailFlow { to { stroke-dashoffset: -24; } }
        .map-trail { animation: mapTrailFlow 0.9s linear infinite; }
        @keyframes mapCurrentPulse { 0%,100% { filter: brightness(1); } 50% { filter: brightness(1.35); } }
        .map-current { animation: mapCurrentPulse 1.8s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .map-trail, .map-current { animation: none; } }
      `}</style>
    </div>
  )
}
