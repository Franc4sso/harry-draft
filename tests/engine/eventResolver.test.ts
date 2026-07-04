import { describe, it, expect } from 'vitest'
import { eventResolver, pickEvent } from '@/game/engine/resolvers/event'
import { createRng } from '@/game/engine/rng'
import { offerRecruits, recruitVia } from '@/game/engine/recruit'
import type { RunNode, RunState } from '@/types'

function baseState(): RunState {
  const team = offerRecruits(createRng(1), { exclude: new Set() })
    .slice(0, 2).map(d => recruitVia(d, 'iniziale'))
  return { seed: 's', phase: 'event-node', team, activeSynergies: [], stage: 0, relics: [],
    area: 0, teamMax: 5, log: [] }
}

/** Find a node id whose deterministic pick (for seed 'seed') lands on 'cappello_parlante' —
 *  an event with an unconditional heal choice ('leave': healTeam pct 0.15). */
function nodeWithHealEvent(): RunNode {
  for (let idx = 0; idx < 50; idx++) {
    const node: RunNode = { id: `a0f1n${idx}`, type: 'event', next: [] }
    const entry = eventResolver.enter(baseState(), node, createRng('seed'))
    if (entry.event?.id === 'cappello_parlante') return node
  }
  throw new Error("no node found landing on 'cappello_parlante' in 50 tries")
}

describe('event resolver', () => {
  it('pickEvent is deterministic per seed', () => {
    expect(pickEvent(createRng('a')).id).toBe(pickEvent(createRng('a')).id)
  })

  it('enter offers the picked event summary (title/text/choices)', () => {
    const s = baseState()
    const node: RunNode = { id: 'a0f1n0', type: 'event', next: [] }
    const entry = eventResolver.enter(s, node, createRng('seed'))
    expect(entry.isCombat).toBe(false)
    expect(entry.event?.choices.length).toBeGreaterThanOrEqual(1)
  })

  it('resolve applies the chosen option effects (heal choice raises currentHp)', () => {
    const node = nodeWithHealEvent()
    const s = baseState()
    const hurt = { ...s, team: s.team.map(dw => ({ ...dw, currentHp: 1 })) }
    const before = hurt.team[0]!.currentHp!
    const next = eventResolver.resolve(hurt, node, { kind: 'event-choice', optionId: 'leave' }, createRng('seed'))
    expect(next.team[0]!.currentHp).toBeGreaterThan(before)
    expect(next.log?.length).toBe((hurt.log?.length ?? 0) + 1)
  })

  it('resolve with an unknown optionId returns state unchanged', () => {
    const node: RunNode = { id: 'a0f1n0', type: 'event', next: [] }
    const s = baseState()
    expect(eventResolver.resolve(s, node, { kind: 'event-choice', optionId: 'nope' }, createRng('s'))).toEqual(s)
  })
})
