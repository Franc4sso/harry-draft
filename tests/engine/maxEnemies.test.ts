import { describe, it, expect } from 'vitest'
import { buildBattlePackage } from '@/game/engine/combat/battlePackage'
import { generateArea } from '@/game/engine/map'
import { createRng } from '@/game/engine/rng'
import { BALANCE } from '@/data/constants'

const MAX = BALANCE.campaignB.maxEnemies

describe('enemy count hard cap (max 5 avversari — user directive)', () => {
  it('maxEnemies is 5 and enemyCountByArea never exceeds it', () => {
    expect(MAX).toBe(5)
    for (const c of BALANCE.campaignB.enemyCountByArea) expect(c).toBeLessThanOrEqual(MAX)
    expect(BALANCE.campaignB.normalEnemyCount).toBeLessThanOrEqual(MAX)
  })

  it('every battle/elite/boss package fits within the cap across all areas and seeds', () => {
    for (const seed of ['a', 'b', 'c', 'seed-42', 'xyzzy']) {
      for (let area = 0; area < BALANCE.map.areas; area++) {
        for (const kind of ['battle', 'elite', 'boss'] as const) {
          const { battle } = buildBattlePackage(seed, area, 1, kind)
          expect(battle.enemyTeam.length, `${seed} area${area} ${kind}`).toBeLessThanOrEqual(MAX)
        }
      }
    }
  })

  it('no generated area node ever carries more than the cap', () => {
    for (const seed of ['run-1', 'run-2', 'run-3']) {
      for (let area = 0; area < BALANCE.map.areas; area++) {
        const nodes = generateArea(createRng(seed).fork(4).fork(area), seed, area, { teamSize: 3, teamMax: 5 })
        for (const n of nodes) {
          if (n.battle) expect(n.battle.enemyTeam.length, n.id).toBeLessThanOrEqual(MAX)
        }
      }
    }
  })
})
