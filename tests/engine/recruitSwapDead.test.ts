import { describe, it, expect } from 'vitest'
import { recruitResolver, recruitOffer } from '@/game/engine/resolvers/recruit'
import { offerRecruits, recruitVia } from '@/game/engine/recruit'
import { createRng } from '@/game/engine/rng'
import { detectSynergies } from '@/game/engine/synergy'
import type { RunNode, RunState } from '@/types'

/** Build a minimal RunState with the given team. */
function mkState(team: RunState['team']): RunState {
  return {
    seed: 'test',
    phase: 'recruit-node',
    team,
    activeSynergies: detectSynergies(team),
    stage: 1,
    relics: [],
    log: [],
    area: 0,
    teamMax: 5,
  }
}

const node: RunNode = { id: 'a0f0n0', type: 'recruit', next: [] }
const rng = createRng('swap-dead')

describe('recruit swap of a dead wizard', () => {
  it('replaceId on a dead wizard drops it and adds the recruit alive', () => {
    // Build a 3-wizard team; mark index 1 as dead (currentHp = 0).
    const base = offerRecruits(createRng('base'), { exclude: new Set() }).slice(0, 3)
    const team = base.map((d, i) =>
      i === 1
        ? { ...recruitVia(d, 'test'), currentHp: 0 }  // dead
        : recruitVia(d, 'test'),
    )
    const deadId = team[1]!.wizard.id

    const state = mkState(team)

    // Get the actual offer (excludes current team members).
    const offer = recruitOffer(state, node, rng)
    const pickedWizard = offer[0]!
    const recruitId = pickedWizard.wizard.id

    // Simulate a full team so replaceId is required (set teamMax = team.length).
    const fullState = { ...state, teamMax: team.length }

    const out = recruitResolver.resolve(
      fullState,
      node,
      { kind: 'recruit-pick', wizardId: recruitId, replaceId: deadId },
      rng,
    )

    expect(out.team.map(d => d.wizard.id)).not.toContain(deadId)   // dead swapped out
    expect(out.team.map(d => d.wizard.id)).toContain(recruitId)     // recruit in
    const recruited = out.team.find(d => d.wizard.id === recruitId)!
    expect(recruited.currentHp ?? recruited.maxHp).toBeGreaterThan(0) // alive
  })

  it('a living wizard is NOT affected by the swap — only the dead one leaves', () => {
    const base = offerRecruits(createRng('base2'), { exclude: new Set() }).slice(0, 3)
    const team = base.map((d, i) =>
      i === 0
        ? { ...recruitVia(d, 'test'), currentHp: 0 }  // dead
        : recruitVia(d, 'test'),
    )
    const deadId = team[0]!.wizard.id
    const survivorIds = team.slice(1).map(d => d.wizard.id)

    const state = mkState(team)
    const offer = recruitOffer(state, node, rng)
    const recruitId = offer[0]!.wizard.id

    const out = recruitResolver.resolve(
      state,
      node,
      { kind: 'recruit-pick', wizardId: recruitId, replaceId: deadId },
      rng,
    )

    expect(out.team.map(d => d.wizard.id)).not.toContain(deadId)
    for (const id of survivorIds) {
      expect(out.team.map(d => d.wizard.id)).toContain(id)
    }
  })
})
