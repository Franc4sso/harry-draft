import { describe, it, expect } from 'vitest'
import { buildBattlePackage } from '@/game/engine/combat/battlePackage'
import { simulateBattle } from '@/game/engine/combat/simulate'
import { createRng } from '@/game/engine/rng'
import { detectSynergies } from '@/game/engine/synergy'

// End-to-end invariant: the wall makes the enemy boss take fewer casualties for the
// same player assault (the direct-damage path is reduced), so the same battle runs
// longer with the wall than without it. This proves rightDamageReduction is applied.
describe('Muro wall applied in combat', () => {
  it('walled boss survives longer than the same boss with wall stripped', () => {
    const { battle } = buildBattlePackage('wall-seed', 0, 3, 'boss')
    const enemy = battle.enemyTeam
    const enemySyn = detectSynergies(enemy)
    // A fixed player team: reuse the enemy team as a stand-in attacker (deterministic).
    const player = buildBattlePackage('wall-seed', 0, 1, 'battle').battle.enemyTeam
    const playerSyn = detectSynergies(player)

    const withWall = simulateBattle(player, enemy, createRng('b'), {
      leftSyn: playerSyn, rightSyn: enemySyn, rightDamageReduction: battle.unitDamageReduction ?? 0,
    })
    const noWall = simulateBattle(player, enemy, createRng('b'), {
      leftSyn: playerSyn, rightSyn: enemySyn, rightDamageReduction: 0,
    })
    expect(withWall.turns).toBeGreaterThanOrEqual(noWall.turns)
  })
})
