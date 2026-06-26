import { describe, it, expect } from 'vitest'
import { startDraft, pickFrom } from '@/game/engine/draftSession'
import { startRun, confirmTeam, nextBattle, advanceToNode, nodeById, addRelic } from '@/game/engine/run'
import { offerRelics } from '@/game/engine/relics'
import { createRng } from '@/game/engine/rng'
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

// Strongest-by-aggregate-bonus heuristic: an upper-bound "optimal relic grab".
function relicScore(r: { bonus?: { hp?: number; atk?: number; def?: number; spd?: number; allPct?: number } }): number {
  const b = r.bonus ?? {}
  return (b.hp ?? 0) + (b.atk ?? 0) * 2 + (b.def ?? 0) * 1.5 + (b.spd ?? 0) + (b.allPct ?? 0) * 400
}

function grabRelic(state: ReturnType<typeof startRun>, n: number) {
  const offers = offerRelics(createRng(`${state.seed}-relic-${n}`), state.relics, state.stage)
  if (offers.length === 0) return state
  const best = offers.reduce((a, b) => (relicScore(b) >= relicScore(a) ? b : a))
  return addRelic(state, best)
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
    // The greedy player also grabs the strongest available relic before the
    // first fight and after each normal victory, mirroring real relic accrual so
    // the difficulty band is measured WITH relics on both sides.
    state = grabRelic(state, 0)
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
      state = grabRelic(state, guard)
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

  it('is brutal but winnable for optimal play (with relics)', () => {
    expect(stats.clearRate).toBeGreaterThan(0.08)
    expect(stats.clearRate).toBeLessThan(0.18)
  })

  it('starts gently — the first fight is usually won', () => {
    expect(stats.firstStageWinRate).toBeGreaterThan(0.65)
  })

  it('peaks at a merciless boss — winnable but rarely', () => {
    expect(stats.bossWinRate).toBeGreaterThan(0)
    expect(stats.bossWinRate).toBeLessThan(0.30)
  })

  it('rarely stalls to the turn cap', () => {
    expect(stats.cappedRate).toBeLessThan(0.05)
  })
})
