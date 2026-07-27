import type { Relic, RunEvent, RunNode, RunState } from '@/types'
import type { Rng } from '../rng'
import { parseAreaNodeId } from '../map'
import { offerSacrifices, addRelicWithChoice } from '../relics'
import { canPay, applySacrificeCost, corruptOnAssign, type SacrificeCost } from '../sacrifice'
import type { NodeResolver } from './types'

/** Deterministica per (seed, node id) — salt 5000 (recruit 1000 / relic 2000 / event 3000 /
 *  4000 riservato a shop, ora rimosso — slot ritirato, non riassegnato). */
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
    if (relic.assignable && !choice.carrierId) return state // never a silent unassigned buy
    if (choice.carrierId && !state.team.some(d => d.wizard.id === choice.carrierId)) return state
    const cost = concreteCost(relic, choice)
    if (!cost || !canPay(state, cost)) return state
    const paid = applySacrificeCost(state, cost)
    if (paid === state) return state
    const active = { relic, stageObtained: paid.stage, ...(choice.carrierId ? { assignedTo: choice.carrierId } : {}) }
    const nextRelics = addRelicWithChoice(paid.relics, active, choice.replaceRelicId)
    if (nextRelics === paid.relics) return state // a 5 senza scelta valida → rifiuto: il costo NON va pagato
    const team = choice.carrierId ? corruptOnAssign(paid.team, relic, choice.carrierId) : paid.team
    const ev: RunEvent = { area: state.area ?? 0, nodeId: node.id, kind: 'altare',
      summary: `All'Altare Oscuro ottieni ${relic.name}, pagando il suo prezzo` }
    return { ...paid, team, relics: nextRelics, log: [...(paid.log ?? []), ev] }
  },
}
