'use client'
import type { RunNode, RunNodeType } from '@/types'
import { parseAreaNodeId, nodeDepth } from '@/game/engine/map'

/** Floor index for any node id (area-scoped `a#f#n#` or legacy `f#n#`). */
function floorOf(id: string): number {
  try { return parseAreaNodeId(id).floor } catch { return nodeDepth(id) }
}

const ICON: Record<RunNodeType, string> = {
  battle: '⚔️', elite: '☠️', boss: '👑', relic: '💎', event: '❓', shop: '🛒',
  recruit: '🧙', commonRoom: '🏠', library: '📚', potions: '🧪', forest: '🌲',
}
const LABEL: Record<RunNodeType, string> = {
  battle: 'Battaglia', elite: 'Elite', boss: 'Boss', relic: 'Reliquia', event: 'Evento',
  shop: 'Negozio', recruit: 'Recluta', commonRoom: 'Sala Comune', library: 'Biblioteca',
  potions: 'Pozioni', forest: 'Foresta',
}

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
  const maxFloor = Math.max(...map.map(n => floorOf(n.id)))
  const reachable = new Set(reachableIds)
  const floors = Array.from({ length: maxFloor + 1 }, (_, f) => map.filter(n => floorOf(n.id) === f))

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6">
      <div className="text-center">
        {area !== undefined && (
          <div className="text-xs uppercase tracking-widest text-gold">
            Area {area + 1}{areasTotal ? ` / ${areasTotal}` : ''}
          </div>
        )}
        <h2 className="text-xl font-bold">Scegli il tuo cammino</h2>
      </div>
      <div className="flex flex-col-reverse gap-8">
        {floors.map((nodes, f) => (
          <div key={f} className="flex justify-center gap-6">
            {nodes.map(n => {
              const isCurrent = n.id === currentNodeId
              const isReachable = reachable.has(n.id)
              return (
                <button
                  key={n.id}
                  data-testid={`node-${n.id}`}
                  disabled={!isReachable}
                  onClick={() => onChoose(n.id)}
                  className={[
                    'rounded-lg px-4 py-3 border text-center transition',
                    isCurrent ? 'border-amber-400 bg-amber-400/10' : 'border-white/15',
                    n.resolved ? 'opacity-50' : '',
                    isReachable ? 'hover:border-amber-300 cursor-pointer' : 'opacity-40 cursor-not-allowed',
                  ].join(' ')}
                >
                  <div className="text-2xl">{ICON[n.type]}</div>
                  <div className="text-xs mt-1">{LABEL[n.type]}</div>
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
