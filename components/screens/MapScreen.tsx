'use client'
import type { RunNode, RunNodeType } from '@/types'
import { nodeDepth } from '@/game/engine/map'

const ICON: Record<RunNodeType, string> = {
  battle: '⚔️', elite: '☠️', boss: '👑', relic: '💎', event: '❓', shop: '🛒',
}
const LABEL: Record<RunNodeType, string> = {
  battle: 'Sfida', elite: 'Elite', boss: 'Boss', relic: 'Reliquia', event: 'Evento', shop: 'Negozio',
}

export function MapScreen({
  map, currentNodeId, reachableIds, onChoose,
}: {
  map: RunNode[]
  currentNodeId: string
  reachableIds: string[]
  onChoose: (nodeId: string) => void
}) {
  const maxFloor = Math.max(...map.map(n => nodeDepth(n.id)))
  const reachable = new Set(reachableIds)
  // Render floors top (boss) to bottom (start) so the player climbs upward.
  const floors = Array.from({ length: maxFloor + 1 }, (_, f) =>
    map.filter(n => nodeDepth(n.id) === f),
  )
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6">
      <h2 className="text-xl font-bold">Scegli il tuo cammino</h2>
      <div className="flex flex-col-reverse gap-8">
        {floors.map((nodes, f) => (
          <div key={f} className="flex justify-center gap-6">
            {nodes.map(n => {
              const isCurrent = n.id === currentNodeId
              const isReachable = reachable.has(n.id)
              return (
                <button
                  key={n.id}
                  disabled={!isReachable}
                  onClick={() => onChoose(n.id)}
                  className={[
                    'rounded-lg px-4 py-3 border text-center transition',
                    isCurrent ? 'border-amber-400 bg-amber-400/10' : 'border-white/15',
                    isReachable ? 'hover:border-amber-300 cursor-pointer' : 'opacity-40 cursor-not-allowed',
                  ].join(' ')}
                  aria-current={isCurrent || undefined}
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
