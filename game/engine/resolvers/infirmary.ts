import type { NodeResolver } from './types'
import type { RunEvent } from '@/types'

/** Full recovery: every wizard (wounded or dead) returns to full HP. No choice. */
export const infirmaryResolver: NodeResolver = {
  id: 'infirmary',
  enter: () => ({ offers: {}, isCombat: false }),
  resolve: (state, node, _choice, _rng) => {
    const team = state.team.map(dw => ({ ...dw, currentHp: dw.maxHp }))
    const ev: RunEvent = { area: state.area ?? 0, nodeId: node.id, kind: 'infirmary', summary: "L'Infermeria ti rimette in sesto: tutti tornano in piena salute." }
    return { ...state, team, log: [...(state.log ?? []), ev] }
  },
}
