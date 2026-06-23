import { describe, it, expect } from 'vitest'
import { startDraft, pickFrom } from '@/game/engine/draftSession'
import { startRun, confirmTeam, nextBattle } from '@/game/engine/run'
import { powerOf } from '@/game/engine/combat/teamGen'

/**
 * Models a near-optimal player: drafts the strongest candidate on every screen.
 * Real players are weaker than this, so these are upper-bound win rates.
 */
function greedyTeam(seed: string) {
  let s = startDraft(seed)
  while (!s.done) {
    let best = 0
    for (let i = 1; i < s.current.length; i++) {
      if (powerOf(s.current[i]!) > powerOf(s.current[best]!)) best = i
    }
    s = pickFrom(s, best)
  }
  return s.picks
}

interface CampaignStats {
  clearRate: number
  bossWinRate: number
  firstStageWinRate: number
  cappedRate: number
}

function simulateCampaigns(n: number): CampaignStats {
  let clears = 0
  let battles = 0
  let capped = 0
  let bossPlays = 0
  let bossWins = 0
  let firstPlays = 0
  let firstWins = 0

  for (let i = 0; i < n; i++) {
    const seed = `campaign-${i}`
    let state = confirmTeam(startRun(seed), greedyTeam(seed))
    while (true) {
      const stage = state.stage
      const out = nextBattle(state)
      battles++
      if (out.result.turns >= 100) capped++
      const won = out.result.winner === 'left'
      if (stage === 0) { firstPlays++; if (won) firstWins++ }
      if (out.isBoss) { bossPlays++; if (won) bossWins++ }
      state = out.state
      if (state.phase === 'win') { clears++; break }
      if (state.phase === 'defeat') break
    }
  }

  return {
    clearRate: clears / n,
    bossWinRate: bossPlays === 0 ? 0 : bossWins / bossPlays,
    firstStageWinRate: firstPlays === 0 ? 0 : firstWins / firstPlays,
    cappedRate: battles === 0 ? 0 : capped / battles,
  }
}

describe('campaign difficulty curve', () => {
  const stats = simulateCampaigns(200)

  it('is winnable but not trivial for optimal play (clear rate ~50%)', () => {
    expect(stats.clearRate).toBeGreaterThan(0.4)
    expect(stats.clearRate).toBeLessThan(0.72)
  })

  it('starts gently — the first fight is almost always won', () => {
    expect(stats.firstStageWinRate).toBeGreaterThan(0.85)
  })

  it('peaks at the boss — a real climax, neither a pushover nor impossible', () => {
    expect(stats.bossWinRate).toBeGreaterThan(0.4)
    expect(stats.bossWinRate).toBeLessThan(0.85)
  })

  it('rarely stalls to the turn cap', () => {
    expect(stats.cappedRate).toBeLessThan(0.05)
  })
})
