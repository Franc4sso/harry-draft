import { describe, it, expect } from 'vitest'
import { startDraft, pickFrom } from '@/game/engine/draftSession'
import { startRun, confirmTeam, nextBattle, advanceToNode, nodeById } from '@/game/engine/run'
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
    // Walk the map graph: fight the current node, and on a normal victory step
    // to the first reachable next node before the next fight (the linear
    // `stage` loop is gone — progression is now node-by-node through the graph).
    let firstFight = true
    let guard = 0
    while (guard++ < 50) {
      const out = nextBattle(state)
      battles++
      if (out.result.turns >= 100) capped++
      const won = out.result.winner === 'left'
      if (firstFight) { firstPlays++; if (won) firstWins++; firstFight = false }
      if (out.isBoss) { bossPlays++; if (won) bossWins++ }
      state = out.state
      if (state.phase === 'win') { clears++; break }
      if (state.phase === 'defeat') break
      // Normal victory: advance to the next floor via the first legal edge.
      const cur = nodeById(state, state.currentNodeId!)!
      state = advanceToNode(state, cur.next[0]!)
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

  it('is winnable but not trivial for optimal play', () => {
    // BAND, not an exact target: the enemy RNG salts moved from linear-stage to
    // node-depth, which legitimately shifted the equilibrium clear rate (~0.36
    // for this build, was tuned to ~0.5 under the old linear progression). The
    // intent we protect is unchanged — the campaign is genuinely winnable for
    // optimal play yet far from a guaranteed clear (neither pushover nor wall).
    // Floor tightened from 0.2 → 0.30 (measured ~0.36; guards against regression).
    expect(stats.clearRate).toBeGreaterThan(0.30)
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
