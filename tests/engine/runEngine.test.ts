import { describe, it, expect, beforeAll } from 'vitest'
import {
  startRunB, starterOffer, chooseStarters, reachable, moveTo, resolveCurrent,
  applyLevelUp, registerCoreResolvers,
} from '@/game/engine/runEngine'
import { createRng } from '@/game/engine/rng'
import { BALANCE } from '@/data/constants'

beforeAll(() => registerCoreResolvers())

describe('run engine — start & map', () => {
  it('startRunB begins at house selection with an empty team', () => {
    const s = startRunB('seed-1')
    expect(s.phase).toBe('house')
    expect(s.team).toHaveLength(0)
    expect(s.teamMax).toBe(BALANCE.draft.teamSize)
  })
  it('chooseStarters builds a 2-wizard team and an area-0 map', () => {
    const offer = starterOffer('seed-1', 'Grifondoro')
    expect(offer.every(d => d.wizard.house === 'Grifondoro')).toBe(true)
    const s = chooseStarters(startRunB('seed-1'), 'Grifondoro', [offer[0]!.wizard.id, offer[1]!.wizard.id], createRng('seed-1'))
    expect(s.phase).toBe('map')
    expect(s.team).toHaveLength(2)
    expect(s.team.every(d => d.level === 1 && d.recruitedVia === 'iniziale')).toBe(true)
    expect(s.map!.length).toBeGreaterThan(0)
    expect(s.currentNodeId).toBe(s.map!.find(n => n.id.endsWith('f0n0'))!.id)
  })
  it('reachable returns the entry node neighbors', () => {
    const offer = starterOffer('seed-1', 'Grifondoro')
    const s = chooseStarters(startRunB('seed-1'), 'Grifondoro', offer.slice(0, 2).map(d => d.wizard.id), createRng('seed-1'))
    expect(reachable(s).length).toBeGreaterThan(0)
  })
})

describe('run engine — node resolution', () => {
  it('moving to a battle node and resolving advances to victory or levelup', () => {
    const offer = starterOffer('seed-7', 'Serpeverde')
    let s = chooseStarters(startRunB('seed-7'), 'Serpeverde', offer.slice(0, 2).map(d => d.wizard.id), createRng('seed-7'))
    const target = reachable(s).find(n => n.type === 'battle') ?? reachable(s)[0]!
    s = moveTo(s, target.id)
    expect(['battle']).toContain(s.phase)
    s = resolveCurrent(s, { kind: 'combat-ack' }, createRng('seed-7').fork(2))
    expect(['victory', 'levelup', 'defeat']).toContain(s.phase)
    // resolved flag set
    expect(s.map!.find(n => n.id === target.id)!.resolved).toBe(true)
  })
})

describe('run engine — level up', () => {
  it('applyLevelUp drains the pending queue and boosts the chosen stat', () => {
    // force a milestone by handing a wizard enough exp via repeated battles is slow;
    // instead seed a pendingLevelUp directly and assert the drain + growth.
    const offer = starterOffer('seed-3', 'Corvonero')
    let s = chooseStarters(startRunB('seed-3'), 'Corvonero', offer.slice(0, 2).map(d => d.wizard.id), createRng('seed-3'))
    const wizId = s.team[0]!.wizard.id
    s = { ...s, phase: 'levelup', pendingLevelUps: [{ wizardId: wizId, atLevel: 3 }] }
    const before = s.team[0]!.growthChoices?.length ?? 0
    s = applyLevelUp(s, wizId, { atLevel: 3, kind: 'atk' })
    expect(s.pendingLevelUps).toHaveLength(0)
    expect(s.team.find(t => t.wizard.id === wizId)!.growthChoices!.length).toBe(before + 1)
  })
})
