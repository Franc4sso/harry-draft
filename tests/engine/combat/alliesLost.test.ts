import { describe, it, expect } from 'vitest'
import { simulateBattle } from '@/game/engine/combat/simulate'
import { draftWizard } from '@/game/engine/statRoll'
import { detectSynergies } from '@/game/engine/synergy'
import { createRng } from '@/game/engine/rng'
import { WIZARDS } from '@/data/wizards'

describe('BattleResult.alliesLost', () => {
  it('counts left-side deaths (lopsided: 1 weak left vs 3 heavy attackers)', () => {
    const fragileBase = WIZARDS.find(w => w.role === 'Supporto')!
    const heavyBase = WIZARDS.find(w => w.id === 'voldemort')!
    const left = [draftWizard(createRng(1), fragileBase)]
    const right = [
      draftWizard(createRng(2), heavyBase),
      draftWizard(createRng(3), heavyBase),
      draftWizard(createRng(4), heavyBase),
    ]
    const result = simulateBattle(left, right, createRng(5))
    expect(result.alliesLost).toBeGreaterThanOrEqual(1)
  })

  it('is 0 when no left unit dies (3 heavy attackers vs 1 trivial right unit)', () => {
    const heavyBase = WIZARDS.find(w => w.id === 'voldemort')!
    const fragileBase = WIZARDS.find(w => w.role === 'Supporto')!
    const left = [
      draftWizard(createRng(2), heavyBase),
      draftWizard(createRng(3), heavyBase),
      draftWizard(createRng(4), heavyBase),
    ]
    const right = [draftWizard(createRng(1), fragileBase)]
    const result = simulateBattle(left, right, createRng(5))
    expect(result.alliesLost).toBe(0)
  })

  it('counts a LEFT unit that dies purely from fatigue (anti-stall true damage), not enemy hits', () => {
    // Mirror-match wall of 5 Tanks vs 5 identical Tanks (same seed both sides): neither side
    // lands any direct Attacco damage on the other (both just buff Fianto Duri defensively),
    // so the only source of HP loss is the escalating post-fatigueStart "Fatica" true damage.
    // All 5 left units die this way by turn 24, each one's final hit logged as `Fatica`.
    const tanks = WIZARDS.filter(w => w.role === 'Tank')
    const left = tanks.slice(0, 5).map(w => draftWizard(createRng(1), w))
    const right = tanks.slice(0, 5).map(w => draftWizard(createRng(1), w))
    const result = simulateBattle(left, right, createRng(1),
      { leftSyn: detectSynergies(left), rightSyn: detectSynergies(right) })

    // Sanity: fatigue actually kicked in and no left unit ever took a direct enemy Attacco.
    expect(result.log.some(e => e.action === 'Fatica')).toBe(true)
    expect(result.log.some(e => e.type === 'Attacco' && e.targetSide === 'left')).toBe(false)

    const deadLeft = result.finalSnapshot.filter(s => s.side === 'left' && !s.alive)
    expect(deadLeft.length).toBeGreaterThanOrEqual(1)
    expect(result.alliesLost).toBeGreaterThanOrEqual(1)
    expect(result.alliesLost).toBe(deadLeft.length)
  })
})
