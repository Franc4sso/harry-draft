import type { Relic, RunEvent, RunNode, RunState } from '@/types'
import type { Rng } from '../rng'
import { parseAreaNodeId } from '../map'
import { offerRelics } from '../relics'
import { detectSynergies } from '../synergy'
import { livingOf } from '../roster'
import { BALANCE } from '@/data/constants'
import type { NodeResolver } from './types'

export type ShopSlotKind = 'relic' | 'heal' | 'removeWizard'
export interface ShopSlot { id: string; kind: ShopSlotKind; price: number; relic?: Relic }
export interface ShopStock { slots: ShopSlot[]; rerollPrice: number }

/** Cioccorane price of a relic by its rarity. */
export function priceForRelic(relic: Relic): number {
  return BALANCE.shop.relicByRarity[relic.rarity]
}

/** Deterministic stock for a shop node: 3 priced relics (re-forked by the node's reroll
 *  counter) + the fixed Cura completa and Rimuovi-mago service slots. Salt base 4000+. */
export function shopOffer(state: RunState, node: RunNode, rng: Rng): ShopStock {
  const { area, floor, idx } = parseAreaNodeId(node.id)
  const r = rng.fork(4000 + area * 100 + floor * 10 + idx).fork(node.shopReroll ?? 0)
  const relics = offerRelics(r, state.relics, 0)
  const slots: ShopSlot[] = relics.map((relic, i) => ({ id: `relic-${i}`, kind: 'relic', price: priceForRelic(relic), relic }))
  slots.push({ id: 'heal', kind: 'heal', price: BALANCE.shop.heal })
  slots.push({ id: 'removeWizard', kind: 'removeWizard', price: BALANCE.shop.removeWizard })
  return { slots, rerollPrice: BALANCE.shop.reroll }
}

function slotSummary(slot: ShopSlot): string {
  if (slot.kind === 'relic') return `Compri ${slot.relic?.name ?? 'una reliquia'}`
  if (slot.kind === 'heal') return 'Cura completa della squadra'
  return 'Rimuovi un mago dalla squadra'
}

export const shopResolver: NodeResolver = {
  id: 'shop',
  enter: () => ({ offers: {}, isCombat: false }),
  resolve: (state, node, choice, rng) => {
    if (choice.kind !== 'shop-buy') return state
    const slot = shopOffer(state, node, rng).slots.find(s => s.id === choice.slotId)
    if (!slot) return state
    if ((node.shopBought ?? []).includes(slot.id)) return state // already sold

    let next = state
    if (slot.kind === 'relic' && slot.relic) {
      const active = { relic: slot.relic, stageObtained: state.stage, ...(choice.carrierId ? { assignedTo: choice.carrierId } : {}) }
      next = { ...next, relics: [...next.relics, active] }
    } else if (slot.kind === 'heal') {
      const healed = next.team.map(dw => ({ ...dw, currentHp: dw.maxHp }))
      next = { ...next, team: healed, activeSynergies: detectSynergies(livingOf(healed)) }
    } else { // removeWizard
      if (!choice.targetWizardId || next.team.length <= 1) return state // never drop below 1
      const team = next.team.filter(d => d.wizard.id !== choice.targetWizardId)
      if (team.length === next.team.length) return state // target not found
      next = { ...next, team, activeSynergies: detectSynergies(livingOf(team)) }
    }

    const map = next.map!.map(n =>
      n.id === node.id ? { ...n, shopBought: [...(n.shopBought ?? []), slot.id] } : n)
    const ev: RunEvent = { area: state.area ?? 0, nodeId: node.id, kind: 'shop', summary: slotSummary(slot) }
    return { ...next, map, log: [...(next.log ?? []), ev] }
  },
}
