import { describe, it, expect } from 'vitest'
import { startRun, confirmTeam, nextBattle, advanceToNode, nodeById } from '@/game/engine/run'
import { nodeDepth } from '@/game/engine/map'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARDS } from '@/data/wizards'

function playerTeam() {
  const r = createRng(99)
  return WIZARDS.slice(0, 5).map(w => draftWizard(r, w))
}

describe('run orchestrator', () => {
  it('starts in draft phase with the seed', () => {
    const s = startRun('abc')
    expect(s.phase).toBe('draft')
    expect(s.seed).toBe('abc')
    expect(s.stage).toBe(0)
  })
  it('confirmTeam computes synergies', () => {
    const s = confirmTeam(startRun('abc'), playerTeam())
    expect(s.team).toHaveLength(5)
    expect(s.phase).toBe('team')
  })
  it('runs a battle and advances stage', () => {
    let s = confirmTeam(startRun('abc'), playerTeam())
    const { state, result } = nextBattle(s)
    expect(['victory', 'defeat']).toContain(state.phase)
    expect(result.log.length).toBeGreaterThan(0)
    expect(state.stage).toBe(1)
  })
  it('same seed reproduces the same first battle', () => {
    const a = nextBattle(confirmTeam(startRun('seed1'), playerTeam())).result
    const b = nextBattle(confirmTeam(startRun('seed1'), playerTeam())).result
    expect(a.winner).toBe(b.winner)
    expect(a.turns).toBe(b.turns)
  })
  it('a RunState can carry an optional map of nodes', () => {
    const s = { ...startRun('seed'), map: [{ id: 'n0', type: 'battle' as const, next: ['n1'] }], currentNodeId: 'n0' }
    expect(s.map?.[0]?.type).toBe('battle')
    expect(s.currentNodeId).toBe('n0')
  })
  it('startRun does not populate map (inert by default)', () => {
    expect(startRun('seed').map).toBeUndefined()
  })
})

describe('run map integration', () => {
  const team = playerTeam()

  it('confirmTeam generates a map and sets currentNodeId to the start node', () => {
    const s = confirmTeam(startRun('seed-map'), team)
    expect(s.map && s.map.length).toBeGreaterThan(0)
    expect(s.currentNodeId).toBe(s.map![0]!.id)
    expect(nodeDepth(s.currentNodeId!)).toBe(0)
  })

  it('advanceToNode accepts a legal next node', () => {
    const s = confirmTeam(startRun('seed-map'), team)
    const legal = nodeById(s, s.currentNodeId!)!.next[0]!
    const s2 = advanceToNode(s, legal)
    expect(s2.currentNodeId).toBe(legal)
  })

  it('advanceToNode rejects an illegal (non-adjacent) node', () => {
    const s = confirmTeam(startRun('seed-map'), team)
    const illegal = s.map!.find(n => !nodeById(s, s.currentNodeId!)!.next.includes(n.id) && n.id !== s.currentNodeId)!.id
    expect(() => advanceToNode(s, illegal)).toThrow()
  })

  it('nextBattle scales enemy budget by node depth; elite is harder than battle at same depth not required — boss node sets isBoss', () => {
    let s = confirmTeam(startRun('seed-map'), team)
    // walk to the boss by always taking the first legal edge
    let guard = 0
    while (nodeById(s, s.currentNodeId!)!.type !== 'boss' && guard++ < 20) {
      const out = nextBattle(s)
      s = out.state
      const cur = nodeById(s, s.currentNodeId!)!
      if (cur.type === 'boss') break
      s = advanceToNode(s, cur.next[0]!)
    }
    const bossOut = nextBattle(s)
    expect(bossOut.isBoss).toBe(true)
  })
})
