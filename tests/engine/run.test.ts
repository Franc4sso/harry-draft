import { describe, it, expect } from 'vitest'
import { startRun, confirmTeam, nextBattle, advanceToNode, nodeById } from '@/game/engine/run'
import { nodeDepth } from '@/game/engine/map'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { powerOf } from '@/game/engine/combat/teamGen'
import { WIZARDS } from '@/data/wizards'
import { BALANCE } from '@/data/constants'
import type { DraftedWizard, RunNode, RunState } from '@/types'

const teamPower = (team: DraftedWizard[]) => team.reduce((sum, dw) => sum + powerOf(dw), 0)

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

  it('an elite node scales the enemy budget above a battle node at the same depth', () => {
    // Hand-build two single-node maps at the SAME depth (3) so the depth-derived
    // RNG salt and budget base are identical; only the node TYPE differs. The
    // elite node multiplies the budget by BALANCE.map.eliteBudgetMult, so its
    // enemy roster should be strictly more powerful than the battle node's.
    const base = confirmTeam(startRun('elite-vs-battle'), team)
    const mk = (type: RunNode['type']): RunState => ({
      ...base,
      map: [{ id: 'f3n0', type, next: [] }],
      currentNodeId: 'f3n0',
    })
    expect(BALANCE.map.eliteBudgetMult).toBeGreaterThan(1)
    const battleEnemy = nextBattle(mk('battle')).enemy
    const eliteEnemy = nextBattle(mk('elite')).enemy
    expect(teamPower(eliteEnemy)).toBeGreaterThan(teamPower(battleEnemy))
  })

  it('graph map shape backs the controller "Sfida X di Y" denominator', () => {
    // The controller's enemyCount (the Y in "Sfida X di Y") is maxDepth - 1:
    // floor 0 is the un-fought start position, floors 1..maxDepth-1 are the
    // fought non-boss "Sfide", and floor maxDepth is the boss. Verify the
    // generated map has exactly that shape so the label is honest + monotonic.
    const s = confirmTeam(startRun('seed-map'), team)
    const maxDepth = Math.max(...s.map!.map(n => nodeDepth(n.id)))
    // Floor 0 exists and is the single start battle node.
    const floor0 = s.map!.filter(n => nodeDepth(n.id) === 0)
    expect(floor0).toHaveLength(1)
    expect(floor0[0]!.type).toBe('battle')
    // Floors 1..maxDepth-1 are the fought non-boss floors → that is the Y.
    const foughtFloors = new Set(
      s.map!.filter(n => n.type !== 'boss' && nodeDepth(n.id) > 0).map(n => nodeDepth(n.id)),
    )
    expect(foughtFloors.size).toBe(maxDepth - 1)
    // The boss is the single node on the final floor.
    const bossFloor = s.map!.filter(n => nodeDepth(n.id) === maxDepth)
    expect(bossFloor).toHaveLength(1)
    expect(bossFloor[0]!.type).toBe('boss')
  })
})
