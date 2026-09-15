'use client'
import { motion, useReducedMotion } from 'framer-motion'
import type { DraftedWizard, RunNode, RunNodeType } from '@/types'
import { parseAreaNodeId, nodeDepth } from '@/game/engine/map'
import { cn } from '@/lib/theme'
import { Insegna } from '@/components/ui/Insegna'
import { WizardCard } from '@/components/cards/WizardCard'

/** Floor index for any node id (area-scoped `a#f#n#` or legacy `f#n#`). */
function floorOf(id: string): number {
  try { return parseAreaNodeId(id).floor } catch { return nodeDepth(id) }
}

const ICON: Record<RunNodeType, string> = {
  battle: '⚔️', elite: '☠️', boss: '👑', relic: '💎', event: '❓',
  recruit: '🧙', commonRoom: '🏠', library: '📚', potions: '🧪', forest: '🌲', infirmary: '🏥',
  altare: '🕯️',
}
const LABEL: Record<RunNodeType, string> = {
  battle: 'Battaglia', elite: 'Elite', boss: 'Boss', relic: 'Reliquia', event: 'Evento',
  recruit: 'Recluta', commonRoom: 'Sala Comune', library: 'Biblioteca',
  potions: 'Pozioni', forest: 'Foresta', infirmary: 'Infermeria',
  altare: 'Altare Oscuro',
}
/** Per-type seal accent (ring + glow + ink tint). */
const ACCENT: Record<RunNodeType, string> = {
  battle: '#b08d57', elite: '#e0833a', boss: '#f5c451', relic: '#a78bfa',
  event: '#c78bf0', recruit: '#5fbf8a', commonRoom: '#6fb1c4',
  library: '#6fb1c4', potions: '#5fbf8a', forest: '#5fbf8a', infirmary: '#10b981',
  altare: '#8b2f4f',
}

// Mini path geometry (Mappa C, task 10): the whole graph as a compact orientation
// strip, ~120px tall. Floor -> x (entry left, boss right, reading like a subway
// line) and node-within-floor -> y — the OPPOSITE axis mapping from the old full-
// height map (which put floors bottom-to-top and scrolled vertically). Swapping
// axes is what lets 5 floors fit in a fixed short band instead of a tall column.
const MINI_COL = 72, MINI_ROW = 30, MINI_NODE = 20, MINI_BOSS = 26
const MINI_TOP_PAD = 18
const MINI_HEIGHT = 120

export function MapScreen({
  map, currentNodeId, reachableIds, onChoose, area, areasTotal, noRecruits, team,
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
  /** Roster shown as the bottom "barra squadra" (Mappa C). Optional so callers
   *  that don't have a team handy (or existing tests) keep working — the bar is
   *  simply omitted when absent. */
  team?: DraftedWizard[]
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
      className="text-left"
    />
  )

  // Defensive: with no nodes there is nothing to wire.
  if (map.length === 0) {
    return <div className="flex-1 flex flex-col items-center gap-5 p-6">{header}</div>
  }

  const maxFloor = Math.max(...map.map(n => floorOf(n.id)))
  const floors = Array.from({ length: maxFloor + 1 }, (_, f) => map.filter(n => floorOf(n.id) === f))
  const maxPerFloor = Math.max(1, ...floors.map(fl => fl.length))
  const miniWidth = (maxFloor + 1) * MINI_COL
  const miniHeight = Math.max(MINI_HEIGHT, maxPerFloor * MINI_ROW + MINI_TOP_PAD * 2)

  // Mini node centres: x by floor (0 = entry, maxFloor = boss), y spread evenly
  // within the floor's own column.
  const pos = new Map<string, { x: number; y: number }>()
  floors.forEach((nodes, f) => {
    nodes.forEach((n, i) => {
      pos.set(n.id, { x: f * MINI_COL + MINI_COL / 2, y: (miniHeight * (i + 1)) / (nodes.length + 1) })
    })
  })

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

  // The reachable choices, in map order — these become the big tiles below.
  const choices = map.filter(n => reachable.has(n.id))

  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-4 pb-3"
      style={{ background: 'radial-gradient(130% 80% at 50% -12%, #1b1436 0%, #100c20 52%, #09070f 100%)' }}
    >
      {header}

      {/* Il cammino, ridotto — solo per orientarsi (~120px), niente più lo
          scorrimento verticale della mappa intera: ogni piano è una colonna,
          l'entrata a sinistra e il boss a destra, come una linea di metro. */}
      <div className="shrink-0 overflow-x-auto overflow-y-hidden rounded-2xl border border-white/10 bg-black/25 [scrollbar-gutter:stable]" style={{ height: MINI_HEIGHT }}>
        <svg
          className="block"
          width={miniWidth} height={miniHeight} viewBox={`0 0 ${miniWidth} ${miniHeight}`}
          fill="none"
        >
          {edges.map(e => {
            const midX = (e.p.x + e.q.x) / 2
            const d = `M ${e.p.x} ${e.p.y} C ${midX} ${e.p.y}, ${midX} ${e.q.y}, ${e.q.x} ${e.q.y}`
            return e.active ? (
              <g key={e.id}>
                <path aria-hidden d={d} stroke="rgba(7,5,14,0.55)" strokeWidth={3.5} strokeLinecap="round" />
                <path data-edge-glow aria-hidden d={d} stroke="rgba(202,162,74,0.24)" strokeWidth={5} strokeLinecap="round" />
                <motion.path
                  data-live-edge d={d} stroke="var(--gold-2)" strokeWidth={2} strokeLinecap="round"
                  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                  transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
                />
              </g>
            ) : (
              <g key={e.id}>
                <path d={d} stroke="rgba(7,5,14,0.6)" strokeWidth={3} strokeLinecap="round" />
                <path d={d} stroke="rgba(233,219,180,0.3)" strokeWidth={1.25} strokeLinecap="round" />
              </g>
            )
          })}
          {map.map(n => {
            const p = pos.get(n.id)
            if (!p) return null
            const isCurrent = n.id === currentNodeId
            const isReachable = reachable.has(n.id)
            const isBoss = n.type === 'boss'
            const sz = isBoss ? MINI_BOSS : MINI_NODE
            const accent = ACCENT[n.type]
            const lit = isReachable || isCurrent
            const blocked = Boolean(noRecruits) && n.type === 'recruit'
            return (
              <g key={n.id} data-testid={`node-${n.id}-dot`} transform={`translate(${p.x - sz / 2}, ${p.y - sz / 2})`}>
                <circle
                  cx={sz / 2} cy={sz / 2} r={sz / 2}
                  fill={lit ? `${accent}55` : '#17122a'}
                  stroke={blocked ? '#e04646' : lit ? accent : 'rgba(255,255,255,0.22)'}
                  strokeWidth={isCurrent ? 2.5 : 1.5}
                  opacity={n.resolved ? 0.5 : 1}
                />
              </g>
            )
          })}
        </svg>
      </div>

      {/* Le tre scelte raggiungibili: riquadri grandi, con chi troverai dentro
          (carta-riga, la stessa carta della squadra) per i nodi di combattimento. */}
      <div className="grid min-h-0 flex-1 gap-3" style={{ gridTemplateColumns: `repeat(${Math.max(1, choices.length)}, minmax(0, 1fr))` }}>
        {choices.map(n => {
          const isBoss = n.type === 'boss'
          const accent = ACCENT[n.type]
          const blocked = Boolean(noRecruits) && n.type === 'recruit'
          const enemies = n.battle?.enemyTeam ?? []
          return (
            <button
              key={n.id}
              type="button"
              data-testid={`node-${n.id}`}
              data-blocked={blocked || undefined}
              onClick={() => onChoose(n.id)}
              aria-label={LABEL[n.type]}
              className={cn(
                'group relative flex min-h-0 flex-col overflow-hidden rounded-2xl border-2 p-3 text-left transition-transform duration-200',
                'cursor-pointer hover:scale-[1.015] focus-visible:scale-[1.015]',
                blocked && 'cursor-not-allowed saturate-[.4] brightness-[.68]',
              )}
              style={{
                borderColor: blocked ? '#e0464688' : accent,
                background: `radial-gradient(120% 80% at 50% 0%, ${accent}22, transparent 60%), #14101f`,
                boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.06), 0 14px 30px -14px rgba(0,0,0,0.8)`,
              }}
            >
              <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
                <span className="flex items-center gap-1.5">
                  <span className={cn('emboss leading-none', isBoss ? 'text-2xl' : 'text-lg')} aria-hidden>{ICON[n.type]}</span>
                  <span className="font-display text-sm font-bold uppercase tracking-wide" style={{ color: accent }}>
                    {LABEL[n.type]}
                  </span>
                </span>
                {n.preview?.bossName && (
                  <span
                    data-testid={`telegraph-${n.id}`}
                    className="group/hint relative shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-bold"
                    style={{ color: '#f5c451', borderColor: 'rgba(245,196,81,0.6)', background: 'rgba(245,196,81,0.16)' }}
                    tabIndex={n.preview.bossHint ? 0 : undefined}
                  >
                    {n.preview.bossName}
                    {n.preview.bossHint && (
                      <span className="pointer-events-none absolute right-0 top-full mt-1 w-max max-w-[200px] whitespace-normal rounded-md border border-white/15 bg-[#15121f]/95 px-2 py-1 text-[9px] font-normal normal-case text-white/85 opacity-0 shadow-lg transition-opacity duration-150 group-hover/hint:opacity-100 group-focus-visible/hint:opacity-100">
                        {n.preview.bossHint}
                      </span>
                    )}
                  </span>
                )}
              </div>

              {/* Chi troverai — carta-riga, come gli alleati. Prende il posto che
                  prima era una tooltip solo-hover: qui è sempre visibile, perché
                  è il punto centrale della scelta (spec: "riquadri grandi con
                  dentro chi troverai"). */}
              {enemies.length > 0 ? (
                <div
                  data-testid={`enemy-preview-${n.id}`}
                  className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-0.5"
                >
                  <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-white/50">
                    {enemies.length} nemic{enemies.length === 1 ? 'o' : 'i'} · Lv {n.battle?.enemyLevel ?? 1}
                  </span>
                  {enemies.map((e, i) => (
                    <WizardCard key={`${e.wizard.id}-${i}`} drafted={e} density="row" className="shrink-0" />
                  ))}
                </div>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 text-center">
                  <span className="emboss text-4xl opacity-60" aria-hidden>{ICON[n.type]}</span>
                  <span className="text-xs text-white/45">
                    {blocked ? 'Non disponibile in questa run' : `Un nodo ${LABEL[n.type].toLowerCase()} ti aspetta.`}
                  </span>
                </div>
              )}

              {blocked && (
                <span
                  data-testid={`node-${n.id}-reason`}
                  className="mt-2 shrink-0 rounded-md border border-rose-400/40 bg-rose-950/40 px-2 py-1 text-center text-[10px] text-rose-200"
                >
                  Il Voto Infrangibile è stato giurato — niente più reclute.
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* In fondo, la barra squadra — carte-riga, stessa densità degli alleati
          nelle anteprime nemici. */}
      {team && team.length > 0 && (
        <div className="shrink-0">
          <p className="mb-1 text-[10px] uppercase tracking-widest text-white/35">La tua squadra</p>
          <div className="flex flex-wrap gap-2">
            {team.map(m => (
              <WizardCard key={m.wizard.id} drafted={m} density="row" currentHp={m.currentHp} className="max-w-xs flex-1" />
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes mapCurrentPulse { 0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.06); opacity: 0.9; } }
        .map-current { animation: mapCurrentPulse 1.8s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .map-current { animation: none; } }
      `}</style>
    </div>
  )
}
