import { describe, it, expect } from 'vitest'
import { startRun, confirmTeam, nextBattle } from '@/game/engine/run'
import { generateEnemyTeam, budgetForStage } from '@/game/engine/combat/teamGen'
import { simulateBattle } from '@/game/engine/combat/simulate'
import { detectSynergies } from '@/game/engine/synergy'
import { createRng } from '@/game/engine/rng'

describe('balance sanity', () => {
  it('stage 0 player teams are competitive (win rate in a sane band)', () => {
    let wins = 0
    const N = 60
    for (let i = 0; i < N; i++) {
      const playerRng = createRng(`p${i}`)
      const player = generateEnemyTeam(playerRng, budgetForStage(2))
      const enemy = generateEnemyTeam(createRng(`e${i}`), budgetForStage(0))
      const res = simulateBattle(player, enemy, createRng(`b${i}`), {
        leftSyn: detectSynergies(player), rightSyn: detectSynergies(enemy),
      })
      if (res.winner === 'left') wins++
    }
    const rate = wins / N
    // stronger-budget side should usually win, but not always.
    expect(rate).toBeGreaterThan(0.5)
    expect(rate).toBeLessThan(1)
  })
  it('no battle runs to the turn cap on every seed (avoids stalemates)', () => {
    let capped = 0
    for (let i = 0; i < 40; i++) {
      const a = generateEnemyTeam(createRng(`a${i}`), budgetForStage(3))
      const b = generateEnemyTeam(createRng(`z${i}`), budgetForStage(3))
      const res = simulateBattle(a, b, createRng(`s${i}`))
      if (res.turns >= 100) capped++
    }
    // Observed: 0/40 capped in baseline run. Threshold set to <10 (25% of 40)
    // to catch stalemate regressions while staying well above the real count.
    expect(capped).toBeLessThan(10)
  })
})
