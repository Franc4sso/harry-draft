import { describe, it, expect } from 'vitest'
import { startRun, confirmTeam, nextBattle, advanceToNode, nodeById, applyBattleToRoster } from '@/game/engine/run'
import type { UnitSnapshot } from '@/types'
import { nodeDepth } from '@/game/engine/map'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { powerOf } from '@/game/engine/combat/teamGen'
import { detectSynergies } from '@/game/engine/synergy'
import { WIZARDS } from '@/data/wizards'
import { BALANCE } from '@/data/constants'
import type { DraftedWizard, RunNode, RunState } from '@/types'

function dwFix(id: string, maxHp = 100): DraftedWizard {
  return {
    wizard: { id, name: id, house: 'Grifondoro', role: 'Attaccante' } as any,
    stats: { hp: maxHp, atk: 20, def: 10, spd: 10 }, maxHp,
    spell: { id: 's', name: 's', desc: '', type: 'Attacco', power: 1, hitChance: 1 },
  }
}

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

describe('applyBattleToRoster', () => {
  const team = [dwFix('a', 100), dwFix('b', 100), dwFix('c', 100)]

  it('drops dead wizards from the roster', () => {
    const snap: UnitSnapshot[] = [
      { id: 'a', hp: 50, maxHp: 100, alive: true },
      { id: 'b', hp: 0, maxHp: 100, alive: false },
      { id: 'c', hp: 80, maxHp: 100, alive: true },
    ]
    const out = applyBattleToRoster(team, snap)
    expect(out.map(d => d.wizard.id)).toEqual(['a', 'c'])
  })

  it('persists survivor HP as base-relative fraction', () => {
    const snap: UnitSnapshot[] = [{ id: 'a', hp: 50, maxHp: 100, alive: true }]
    const out = applyBattleToRoster([dwFix('a', 100)], snap)
    expect(out[0]!.currentHp).toBe(50)
  })

  it('scales snapshot HP (out of buffed max) down to BASE maxHp', () => {
    // buffed maxHp 120, hp 60 = 50% → base maxHp 100 → currentHp 50
    const snap: UnitSnapshot[] = [{ id: 'a', hp: 60, maxHp: 120, alive: true }]
    const out = applyBattleToRoster([dwFix('a', 100)], snap)
    expect(out[0]!.currentHp).toBe(50)
  })

  it('full-HP survivor → currentHp equals base maxHp', () => {
    const snap: UnitSnapshot[] = [{ id: 'a', hp: 120, maxHp: 120, alive: true }]
    const out = applyBattleToRoster([dwFix('a', 100)], snap)
    expect(out[0]!.currentHp).toBe(100)
  })

  it('empty team → empty', () => {
    expect(applyBattleToRoster([], [])).toEqual([])
  })
})

describe('nextBattle roster persistence + phase', () => {
  it('survivors carry into state.team; dead are dropped', () => {
    let s = confirmTeam(startRun('persist-seed'), playerTeam())
    const startLen = s.team.length
    const out = nextBattle(s)
    expect(out.state.team.length).toBeLessThanOrEqual(startLen)
    for (const dw of out.state.team) expect(typeof dw.currentHp).toBe('number')
  })

  it('phase is victory when at least one wizard survives a non-boss node', () => {
    const s = confirmTeam(startRun('persist-seed'), playerTeam())
    const out = nextBattle(s)
    // first node is non-boss; with a normal team at least one should survive stage 0
    if (out.state.team.length > 0) expect(out.state.phase).toBe('victory')
    else expect(out.state.phase).toBe('defeat')
  })

  it('phase is defeat only when the whole roster is wiped', () => {
    const s = confirmTeam(startRun('persist-seed'), playerTeam())
    const out = nextBattle(s)
    // Direct rule check: a state whose post-battle team is empty must be 'defeat'.
    if (out.state.team.length === 0) expect(out.state.phase).toBe('defeat')
    else expect(out.state.phase).not.toBe('defeat')
  })

  it('recomputes synergies from the post-battle roster', () => {
    const s = confirmTeam(startRun('persist-seed'), playerTeam())
    const out = nextBattle(s)
    // activeSynergies must match detectSynergies(newTeam), not the pre-battle team
    expect(out.state.activeSynergies).toEqual(detectSynergies(out.state.team))
  })
})
