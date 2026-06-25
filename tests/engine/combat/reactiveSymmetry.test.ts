import { describe, it, expect } from 'vitest'
import { simulateBattle } from '@/game/engine/combat/simulate'
import { draftWizard } from '@/game/engine/statRoll'
import { detectSynergies } from '@/game/engine/synergy'
import { createRng } from '@/game/engine/rng'
import { WIZARD_BY_ID } from '@/data/wizards'

function team(seed: number) {
  const rng = createRng(seed)
  const traitlessIds = ['dumbledore', 'harry', 'snape', 'sirius', 'moody']
  return traitlessIds.map(id => draftWizard(rng, WIZARD_BY_ID[id]!))
}

describe('reactive symmetry', () => {
  it('trait-less battles draw no trait procs and are reproducible', () => {
    const a = simulateBattle(team(1), team(2), createRng(3),
      { leftSyn: detectSynergies(team(1)), rightSyn: detectSynergies(team(2)) })
    const b = simulateBattle(team(1), team(2), createRng(3),
      { leftSyn: detectSynergies(team(1)), rightSyn: detectSynergies(team(2)) })
    expect(a.log.length).toBe(b.log.length)
    expect(a.winner).toBe(b.winner)
    expect(a.turns).toBe(b.turns)
    expect(JSON.stringify(a.log)).toBe(JSON.stringify(b.log))
    // Verify no trait procs (Sifone, Benedizione) appear in the log
    expect(a.log.some(e => e.action === 'Sifone' || e.action === 'Benedizione')).toBe(false)
  })
})
