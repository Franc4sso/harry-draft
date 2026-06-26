import type { BattleUnit, Signature } from '@/types'
import type { EventBus } from './combat/eventBus'
import { SIGNATURE_BY_ID } from '@/data/signatures'

export function registerSignatures(
  bus: EventBus, units: BattleUnit[], catalog: Record<string, Signature> = SIGNATURE_BY_ID,
): void {
  for (const u of units) {
    const sig = catalog[u.wizard.id]
    if (!sig) continue
    for (const t of sig.triggers) {
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
