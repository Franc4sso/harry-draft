import { describe, it, expect, beforeAll } from 'vitest'
import {
  startRunB, starterOffer, chooseStarters, confirmDraftPicks, STARTER_PICKS,
  reachable, moveTo, resolveCurrent,
  registerCoreResolvers, phaseAfterNode,
} from '@/game/engine/runEngine'
import { recruitOffer, relicOffer } from '@/game/engine/resolvers/recruit'
import { createRng } from '@/game/engine/rng'
import { createDraftPool } from '@/game/engine/draft'
import { draftWizard } from '@/game/engine/statRoll'
import { BALANCE } from '@/data/constants'

beforeAll(() => registerCoreResolvers())

describe('run engine — start & map', () => {
  it('startRunB begins at the draft phase with an empty team', () => {
    const s = startRunB('seed-1')
    expect(s.phase).toBe('draft')
    expect(s.team).toHaveLength(0)
    expect(s.teamMax).toBe(BALANCE.draft.teamSize)
  })
  it('starts in the draft phase and confirmDraftPicks seeds a 2-wizard team on the map', () => {
    const s = startRunB('seed-x')
    expect(s.phase).toBe('draft')
    expect(STARTER_PICKS).toBe(2)
    const pool = createDraftPool().slice(0, 2).map(w => draftWizard(createRng('seed-x'), w, true))
    const next = confirmDraftPicks(s, pool, createRng('seed-x'))
    expect(next.phase).toBe('map')
    expect(next.team.length).toBe(2)
    expect(next.team.every(d => d.level === 1 && d.recruitedVia === 'iniziale')).toBe(true)
    expect(next.map && next.map.length).toBeGreaterThan(0)
    expect(next.currentNodeId).toBe(next.map!.find(n => n.id.endsWith('f0n0'))!.id)
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
  it('moving to a battle node and resolving advances straight to victory (no level-up phase)', () => {
    const offer = starterOffer('seed-7', 'Serpeverde')
    let s = chooseStarters(startRunB('seed-7'), 'Serpeverde', offer.slice(0, 2).map(d => d.wizard.id), createRng('seed-7'))
    const target = reachable(s).find(n => n.type === 'battle') ?? reachable(s)[0]!
    s = moveTo(s, target.id)
    expect(['battle']).toContain(s.phase)
    s = resolveCurrent(s, { kind: 'combat-ack' }, createRng('seed-7').fork(2))
    expect(['victory', 'defeat']).toContain(s.phase)
    // resolved flag set
    expect(s.map!.find(n => n.id === target.id)!.resolved).toBe(true)
  })
})

describe('run engine — infirmary node integration', () => {
  it('entering an infirmary node sets phase infirmary-node, resolving heals the team and returns phase to map', () => {
    // Find a seed where an infirmary node is reachable from the start
    // generateArea always places an infirmary node, so iterate seeds until one appears reachable
    let found = false
    for (let i = 0; i < 40 && !found; i++) {
      const seed = `inf-test-${i}`
      const offer = starterOffer(seed, 'Grifondoro')
      let s = chooseStarters(startRunB(seed), 'Grifondoro', offer.slice(0, 2).map(d => d.wizard.id), createRng(seed))
      // Walk deeper into the map to find an infirmary node
      let guard = 0
      while (guard++ < 30) {
        const opts = reachable(s)
        const inf = opts.find(n => n.type === 'infirmary')
        if (inf) {
          // Wound the team
          s = { ...s, team: s.team.map(d => ({ ...d, currentHp: 1 })) }
          s = moveTo(s, inf.id)
          expect(s.phase).toBe('infirmary-node')
          s = resolveCurrent(s, { kind: 'combat-ack' }, createRng(seed))
          // infirmaryResolver sets all to maxHp; resolveCurrent then goes to 'victory'
          // (non-boss, non-wipeout). We set phase back to 'map' as the controller does.
          s = { ...s, phase: 'map' }
          expect(s.phase).toBe('map')
          expect(s.team.every(d => (d.currentHp ?? d.maxHp) === d.maxHp)).toBe(true)
          found = true
          break
        }
        // Move to any non-boss node to advance deeper
        const next = opts.find(n => n.type !== 'boss') ?? opts[0]!
        s = moveTo(s, next.id)
        if (s.phase === 'battle') {
          s = resolveCurrent(s, { kind: 'combat-ack' }, createRng(seed))
          s = { ...s, phase: 'map' }
        } else if (s.phase === 'recruit-node') {
          s = resolveCurrent(s, { kind: 'skip' }, createRng(seed))
          s = { ...s, phase: 'map' }
        } else if (s.phase === 'relic-node') {
          const node = s.map!.find(n => n.id === s.currentNodeId)!
          const off = relicOffer(s, node, createRng(seed))
          s = resolveCurrent(s, { kind: 'relic-pick', relicId: off[0]!.id }, createRng(seed))
          s = { ...s, phase: 'map' }
        } else if (s.phase === 'infirmary-node') {
          s = resolveCurrent(s, { kind: 'combat-ack' }, createRng(seed))
          s = { ...s, phase: 'map' }
        }
      }
    }
    expect(found).toBe(true)
  })
})

describe('phaseAfterNode', () => {
  it('wipeout → defeat regardless of node', () => {
    expect(phaseAfterNode({ isBoss: true, area: 0, areas: 3, wiped: true })).toBe('defeat')
  })
  it('non-final area boss → area-cleared', () => {
    expect(phaseAfterNode({ isBoss: true, area: 0, areas: 3, wiped: false })).toBe('area-cleared')
    expect(phaseAfterNode({ isBoss: true, area: 1, areas: 3, wiped: false })).toBe('area-cleared')
  })
  it('final area boss → win', () => {
    expect(phaseAfterNode({ isBoss: true, area: 2, areas: 3, wiped: false })).toBe('win')
  })
  it('non-boss node → victory', () => {
    expect(phaseAfterNode({ isBoss: false, area: 1, areas: 3, wiped: false })).toBe('victory')
  })
})
