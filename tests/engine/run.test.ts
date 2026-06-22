import { describe, it, expect } from 'vitest'
import { startRun, confirmTeam, nextBattle } from '@/game/engine/run'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARDS } from '@/data/wizards'

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
})
