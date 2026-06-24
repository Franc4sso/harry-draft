import { describe, it, expect } from 'vitest'
import { simulateBattle } from '@/game/engine/combat/simulate'
import { draftWizard } from '@/game/engine/statRoll'
import { detectSynergies } from '@/game/engine/synergy'
import { createRng } from '@/game/engine/rng'
import { WIZARDS } from '@/data/wizards'

function team(seed: number) {
  const rng = createRng(seed)
  return WIZARDS.slice(0, 10).filter((_, i) => i % 2 === 0).slice(0, 5).map(w => draftWizard(rng, w))
}

describe('reactive symmetry', () => {
  it('trait-less battles are byte-identical (determinism preserved)', () => {
    const a = simulateBattle(team(1), team(2), createRng(3),
      { leftSyn: detectSynergies(team(1)), rightSyn: detectSynergies(team(2)) })
    const b = simulateBattle(team(1), team(2), createRng(3),
      { leftSyn: detectSynergies(team(1)), rightSyn: detectSynergies(team(2)) })
    expect(a.log.length).toBe(b.log.length)
    expect(a.winner).toBe(b.winner)
    expect(a.turns).toBe(b.turns)
    expect(JSON.stringify(a.log)).toBe(JSON.stringify(b.log))
  })
})
