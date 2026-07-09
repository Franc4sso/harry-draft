import { describe, it, expect } from 'vitest'
import { resolveCombat } from '@/game/engine/resolvers/combat'
import { generateArea } from '@/game/engine/map'
import { createRng } from '@/game/engine/rng'
import { offerRecruits, recruitVia } from '@/game/engine/recruit'
import { leveledStats } from '@/game/engine/leveling'
import type { RunState, RunNode } from '@/types'

function statTotal(stats: { hp: number; atk: number; def: number; spd: number }): number {
  return stats.hp + stats.atk + stats.def + stats.spd
}

function starterState(): RunState {
  const team = offerRecruits(createRng(1), { exclude: new Set() })
    .slice(0, 2).map(d => recruitVia(d, 'iniziale', 1))
  const map = generateArea(createRng(1).fork(4).fork(0), 'test', 0, { teamSize: 2, teamMax: 5 })
  return { seed: 's', phase: 'map', team, activeSynergies: [], stage: 0, relics: [],
    map, currentNodeId: map[0]!.id, house: 'Serpeverde', area: 0, teamMax: 5, log: [], pendingLevelUps: [] }
}

describe('resolveCombat — stale pre-f67fe4e save fallback', () => {
  it('stamps the persisted pkg.enemyLevel onto enemy units missing a level field, so they get leveled stats', () => {
    const s = starterState()
    // Use an 'elite' node, not a plain 'battle': area-0 normal fights were lowered to
    // enemyLevel exactly 1 (2026-07-02 balance fix, data/constants.ts campaignB), which
    // would make the level1Stats comparison below vacuous. Area-0 elite is level 2 —
    // still genuinely > 1 — so the stale-save leveled-stats fallback is still exercised.
    const battleNode = s.map!.find((n: RunNode) => n.type === 'elite' && n.battle)!
    // Simulate a save generated BEFORE f67fe4e: enemyTeam units carry no `level`,
    // even though the package itself still records the intended enemyLevel.
    const staleNode: RunNode = {
      ...battleNode,
      battle: {
        ...battleNode.battle!,
        enemyTeam: battleNode.battle!.enemyTeam.map(dw => {
          const { level: _drop, ...rest } = dw
          return rest as typeof dw
        }),
      },
    }
    expect(staleNode.battle!.enemyLevel).toBeGreaterThan(1)
    for (const dw of staleNode.battle!.enemyTeam) expect(dw.level).toBeUndefined()

    const state: RunState = { ...s, currentNodeId: staleNode.id }
    const out = resolveCombat(state, staleNode, createRng('s').fork(2))

    // The enemies that came back out of resolveCombat must reflect leveled stats,
    // not flat level-1 base stats, despite the missing per-unit level field.
    for (const dw of out.enemy) {
      const base = staleNode.battle!.enemyTeam.find(e => e.wizard.id === dw.wizard.id)!
      const level1Stats = leveledStats({ ...base, level: 1 })
      expect(statTotal(dw.stats)).toBeGreaterThan(statTotal(level1Stats))
    }
  })
})
