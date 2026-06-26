import { describe, it, expect } from 'vitest'
import { startRun, confirmTeam, nextBattle } from '@/game/engine/run'
import { generateEnemyTeam, budgetForStage } from '@/game/engine/combat/teamGen'
import { simulateBattle } from '@/game/engine/combat/simulate'
import { detectSynergies } from '@/game/engine/synergy'
import { createRng } from '@/game/engine/rng'

describe('balance sanity', () => {
  it('budget is a meaningful difficulty dial (a clearly richer team usually wins)', () => {
    // Budget must translate into strength: a late-stage team should beat a
    // baseline one most of the time. The brutal-difficulty recalibration made the
    // budget curve gentler (budgetStep 220->120), so a 4-stage gap is now only
    // ~1.14x power — too small to be decisive, and under fixed stats the
    // budget->roster mapping is jumpy (a richer team can lose specific matchups).
    // We therefore test a clearly richer ~8-stage gap (~1.31x power), where the
    // dial is unambiguous. Measured winRate ~0.83 (n=60, deterministic).
    let wins = 0
    const N = 60
    for (let i = 0; i < N; i++) {
      const playerRng = createRng(`p${i}`)
      const player = generateEnemyTeam(playerRng, budgetForStage(8))
      const enemy = generateEnemyTeam(createRng(`e${i}`), budgetForStage(0))
      const res = simulateBattle(player, enemy, createRng(`b${i}`), {
        leftSyn: detectSynergies(player), rightSyn: detectSynergies(enemy),
      })
      if (res.winner === 'left') wins++
    }
    const rate = wins / N
    // stronger-budget side should usually win, but not always.
    expect(rate).toBeGreaterThan(0.6)
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
