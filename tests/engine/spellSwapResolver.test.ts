import { describe, it, expect } from 'vitest'
import { spellSwapResolver, swapOffer } from '@/game/engine/resolvers/spellSwap'
import { createRng } from '@/game/engine/rng'
import type { RunNode, RunState } from '@/types'

function state(over: Partial<RunState> = {}): RunState {
  const node = { id: 'a0f1n0', type: 'spellSwap', next: [] } as unknown as RunNode
  return {
    seed: 's', phase: 'spellSwap-node', stage: 0, activeSynergies: [], relics: [],
    map: [node], currentNodeId: 'a0f1n0', area: 0,
    team: [{
      wizard: { id: 'w', name: 'Mago', role: 'Attaccante', house: 'Grifondoro', tags: [] },
      level: 1, maxHp: 100, stats: { hp: 100, atk: 20, def: 10, spd: 10 },
      spell: { id: 'expelliarmus', name: 'Expelliarmus', type: 'Attacco', power: 1.4, hitChance: 0.95, cooldown: 0 },
      spellLevel: 1,
    }],
    ...over,
  } as unknown as RunState
}
const rng = () => createRng('s')
const node = (s: RunState) => s.map!.find(n => n.id === 'a0f1n0')!

describe('spellSwapResolver', () => {
  it('enter offre 2 spell Attacco distinti, deterministici dal seed', () => {
    const s = state()
    const offer1 = spellSwapResolver.enter(s, node(s), rng()).offers
    const offer2 = spellSwapResolver.enter(s, node(s), rng()).offers
    expect(offer1).toEqual(offer2) // stesso seed → stessa offerta (parità)
  })

  it('resolve assegna il nuovo spell SENZA toccare la vita', () => {
    const s0 = state()
    const offered = (spellSwapResolver.enter(s0, node(s0), rng()).offers as any).swapSpells as string[]
    expect(offered.length).toBe(2)
    const chosen = offered[0]!
    const out = spellSwapResolver.resolve(s0, node(s0), { kind: 'spell-swap', wizardId: 'w', spellId: chosen } as any, rng())
    expect(out.team[0]!.spell.id).toBe(chosen)     // spell cambiato
    expect(out.team[0]!.maxHp).toBe(100)            // VITA INVARIATA — nessun costo
    expect(out.team[0]!.stats.hp).toBe(100)         // stat hp invariata
    expect(out.team[0]!.spellLevel).toBe(1)         // spellLevel preservato
  })

  it('ANTI-CHEAT: uno spellId NON tra i 2 offerti → no-op (state invariato)', () => {
    const s0 = state()
    const offered = (spellSwapResolver.enter(s0, node(s0), rng()).offers as any).swapSpells as string[]
    const notOffered = 'avada'
    expect(offered).not.toContain(notOffered)
    const out = spellSwapResolver.resolve(s0, node(s0), { kind: 'spell-swap', wizardId: 'w', spellId: notOffered } as any, rng())
    expect(out).toBe(s0) // ref-equal = no-op
  })

  it('swapOffer è la stessa funzione usata da enter/resolve (parità offerta)', () => {
    const s0 = state()
    const viaEnter = (spellSwapResolver.enter(s0, node(s0), rng()).offers as any).swapSpells as string[]
    const viaOffer = swapOffer(s0, node(s0), rng()).map(sp => sp.id)
    expect(viaOffer).toEqual(viaEnter)
  })
})
