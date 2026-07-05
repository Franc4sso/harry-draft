import { describe, it, expect } from 'vitest'
import { shopResolver, shopOffer } from '@/game/engine/resolvers/shop'
import { createRng } from '@/game/engine/rng'
import { offerRecruits, recruitVia } from '@/game/engine/recruit'
import type { RunNode, RunState } from '@/types'

function team(n: number) {
  return offerRecruits(createRng(1), { exclude: new Set() }).slice(0, n).map(d => recruitVia(d, 'iniziale'))
}
function state(over: Partial<RunState> = {}): RunState {
  const node: RunNode = { id: 'a0f1n0', type: 'shop', next: [] }
  return { seed: 's', phase: 'shop-node', team: team(2), activeSynergies: [], stage: 0, relics: [],
    map: [node], currentNodeId: 'a0f1n0', area: 0, ...over }
}
const rng = () => createRng('s')
const node = (s: RunState) => s.map!.find(n => n.id === 'a0f1n0')!

describe('shopResolver', () => {
  it('buying a relic appends it and records the slot as sold', () => {
    const s = state()
    const relicSlot = shopOffer(s, node(s), rng()).slots.find(x => x.kind === 'relic')!
    const out = shopResolver.resolve(s, node(s), { kind: 'shop-buy', slotId: relicSlot.id }, rng())
    expect(out.relics.map(r => r.relic.id)).toContain(relicSlot.relic!.id)
    expect(node(out).shopBought).toContain(relicSlot.id)
  })
  it('buying the heal restores every wizard to full HP', () => {
    const wounded = state()
    wounded.team = wounded.team.map(d => ({ ...d, currentHp: 1 }))
    const out = shopResolver.resolve(wounded, node(wounded), { kind: 'shop-buy', slotId: 'heal' }, rng())
    for (const d of out.team) expect(d.currentHp).toBe(d.maxHp)
    expect(node(out).shopBought).toContain('heal')
  })
  it('removeWizard drops the target and refuses to go below 1 member', () => {
    const s = state()
    const victim = s.team[1]!.wizard.id
    const out = shopResolver.resolve(s, node(s), { kind: 'shop-buy', slotId: 'removeWizard', targetWizardId: victim }, rng())
    expect(out.team.map(d => d.wizard.id)).not.toContain(victim)
    expect(out.team).toHaveLength(1)
    // now at 1 member: another remove is a no-op (same state object)
    const solo = shopResolver.resolve(out, node(out), { kind: 'shop-buy', slotId: 'removeWizard', targetWizardId: out.team[0]!.wizard.id }, rng())
    expect(solo).toBe(out)
  })
  it('an already-bought slot is a no-op', () => {
    const s = state()
    const first = shopResolver.resolve(s, node(s), { kind: 'shop-buy', slotId: 'heal' }, rng())
    const again = shopResolver.resolve(first, node(first), { kind: 'shop-buy', slotId: 'heal' }, rng())
    expect(again).toBe(first)
  })
  it('buying relic-0 then relic-1 in the same shop appends the two distinct relics that were displayed (stock stays stable across purchases)', () => {
    const s = state()
    const originalOffer = shopOffer(s, node(s), rng())
    const relic0 = originalOffer.slots.find(x => x.id === 'relic-0')!
    const relic1 = originalOffer.slots.find(x => x.id === 'relic-1')!

    const afterFirst = shopResolver.resolve(s, node(s), { kind: 'shop-buy', slotId: 'relic-0' }, rng())
    const afterSecond = shopResolver.resolve(afterFirst, node(afterFirst), { kind: 'shop-buy', slotId: 'relic-1' }, rng())

    const boughtIds = afterSecond.relics.map(r => r.relic.id)
    expect(boughtIds).toContain(relic0.relic!.id)
    expect(boughtIds).toContain(relic1.relic!.id)
    expect(relic0.relic!.id).not.toBe(relic1.relic!.id)
  })
})
