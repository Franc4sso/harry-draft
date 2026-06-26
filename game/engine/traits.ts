import type { BattleUnit, Trait } from '@/types'
import type { EventBus } from './combat/eventBus'
import { TRAIT_BY_ID } from '@/data/traits'

export function registerTraitTriggers(
  bus: EventBus, units: BattleUnit[], catalog: Record<string, Trait> = TRAIT_BY_ID,
): void {
  for (const u of units) {
    for (const id of (u.shiny ? [u.shiny.traitId] : [])) {
      const trait = catalog[id]
      if (!trait) continue
      const t = trait.trigger
      const ownerOf = (ctx: { actor: BattleUnit; target?: BattleUnit }) =>
        t.owner === 'actor' ? ctx.actor : ctx.target
      if (t.kind === 'modifier') {
        bus.onModifier(t.hook, (v, ctx) => (ownerOf(ctx) === u ? t.apply(v, ctx) : v))
      } else {
        bus.onReactive(t.hook, (ctx) => (ownerOf(ctx) === u ? t.effects(ctx) : []))
      }
    }
  }
}
