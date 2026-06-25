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
    // BAND, not an exact target. Persistent HP + permanent death (HP-persistence
    // feature) means wounds carry and deaths compound across the graph walk, so a
    // full clear now requires surviving every floor AND the boss with a roster
    // intact enough to win. After the C1 fix (the snapshot/roster path no longer
    // clobbers a surviving player with a same-id enemy entry — survivors are kept,
    // not dropped) the clear rate rose to ~0.04 measured (n=200). Assigning traits
    // to all 60 wizards made enemies meaningfully tougher; that measured rate
    // settled at ~0.015–0.016 (n=200 and n=500, deterministic). The 2026-06-25
    // combat overhaul (graduated 2/3/4 synergies + percentage debuffs + 30%
    // control) re-measured the optimal-play clear rate at ~0.023 (n=300,
    // deterministic): graduated synergies help the optimal drafter slightly more
    // than the stronger debuffs hurt, so the rate nudged up, not down. The intent
    // we protect is unchanged: the campaign is still WINNABLE for optimal play
    // (clears happen, rate > 0) yet far from a guaranteed clear (no pushover). The
    // floor stays 0.008 (~a third of the new measured rate — ample margin, guards
    // "still winnable"); the upper bound (no-pushover) is left wide and unchanged.
    expect(stats.clearRate).toBeGreaterThan(0.008)
    expect(stats.clearRate).toBeLessThan(0.72)
  })

  it('starts gently — the first fight is usually won', () => {
    // Fixed midpoint stats shifted the seeded RNG stream; measured rate is now ~0.775 (n=200).
    expect(stats.firstStageWinRate).toBeGreaterThan(0.70)
  })

  it('peaks at the boss — a real climax, neither a pushover nor impossible', () => {
    // BAND. Under HP-persistence the rosters that reach the boss arrive wounded
    // (and often depleted), so the boss win-rate among boss plays sits well below
    // the old full-heal ~0.5. After the C1 fix (wounded survivors are correctly
    // carried to the boss instead of being dropped/clobbered) the boss win-rate
    // among boss plays is ~0.25–0.33 measured (n=200–300; the 2026-06-25 combat
    // overhaul nudged it to ~0.33). Intent preserved: the boss is a real climax —
    // not impossible (rate > 0, wins do happen) and not a pushover (well under the
    // old ceiling). Floor set comfortably below the measured band.
    expect(stats.bossWinRate).toBeGreaterThan(0.20)
    expect(stats.bossWinRate).toBeLessThan(0.85)
  })

  it('rarely stalls to the turn cap', () => {
    expect(stats.cappedRate).toBeLessThan(0.05)
  })
})
