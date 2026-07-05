import type { Relic, RunNode, RunState } from '@/types'
import type { Rng } from '../rng'
import { parseAreaNodeId } from '../map'
import { offerRelics } from '../relics'
import { BALANCE } from '@/data/constants'

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
