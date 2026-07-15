import type { Relic, RunEvent, RunNode, RunState } from '@/types'
import type { Rng } from '../rng'
import { parseAreaNodeId } from '../map'
import { offerSacrifices } from '../relics'
import { canPay, applySacrificeCost, type SacrificeCost } from '../sacrifice'
import type { NodeResolver } from './types'

/** Deterministica per (seed, node id) — salt 5000 (recruit 1000 / relic 2000 / event 3000 / shop 4000). */
export function altareOffer(state: RunState, node: RunNode, rng: Rng): Relic[] {
  const { area, floor, idx } = parseAreaNodeId(node.id)
  const r = rng.fork(5000 + area * 100 + floor * 10 + idx)
  return offerSacrifices(r, state.relics)
}

/** Concretizza il template di costo della reliquia con la selezione del giocatore.
 *  null = selezione mancante/malformata (→ no-op del resolver, mai un default silenzioso). */
function concreteCost(relic: Relic, choice: { costWizardId?: string; costRelicId?: string }): SacrificeCost | null {
  const t = relic.sacrificeCost
  if (!t) return null
  switch (t.kind) {
    case 'wizard': return choice.costWizardId ? { kind: 'wizard', wizardId: choice.costWizardId } : null
    case 'relic': return choice.costRelicId ? { kind: 'relic', relicId: choice.costRelicId } : null
    case 'maxHp': return choice.costWizardId ? { kind: 'maxHp', wizardId: choice.costWizardId, amount: t.amount } : null
  }
}

export const altareResolver: NodeResolver = {
  id: 'altare',
  enter: (state, node, rng) => ({ offers: { relicIds: altareOffer(state, node, rng).map(r => r.id) }, isCombat: false }),
  resolve: (state, node, choice, rng) => {
    if (choice.kind !== 'altare-buy') return state
    const relic = altareOffer(state, node, rng).find(r => r.id === choice.relicId)
    if (!relic) return state
    const cost = concreteCost(relic, choice)
    if (!cost || !canPay(state, cost)) return state
    const paid = applySacrificeCost(state, cost)
    if (paid === state) return state
    const ev: RunEvent = { area: state.area ?? 0, nodeId: node.id, kind: 'altare',
      summary: `All'Altare Oscuro ottieni ${relic.name}, pagando il suo prezzo` }
    return { ...paid, relics: [...paid.relics, { relic, stageObtained: paid.stage }], log: [...(paid.log ?? []), ev] }
  },
}
