import { describe, it, expect } from 'vitest'
import { simulateBattle } from '@/game/engine/combat/simulate'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARDS } from '@/data/wizards'

function team(rng = createRng(1), n = 5) {
  return WIZARDS.slice(0, 200).filter((_, i) => i % 2 === 0).slice(0, n).map(w => draftWizard(rng, w))
}

describe('LogEntry.reason nel sim', () => {
  it('le azioni di attacco verso un nemico portano un reason', () => {
    const res = simulateBattle(team(createRng(1)), team(createRng(2)), createRng(3))
    const atk = res.log.find(e => e.type !== 'system' && e.targetSide != null && e.actorSide != null
      && e.targetSide !== e.actorSide && !e.flags.includes('heal') && (e.value ?? 0) > 0)
    expect(atk?.reason).toBeTruthy()
  })

  it('le cure NON hanno reason', () => {
    const left = team(createRng(1))
    const right = team(createRng(2))
    const regenSyn = [{
      synergy: {
        id: 'testRegen', name: 'Test Regen', kind: 'role' as const,
        requires: { role: 'Supporto' as const, count: 1 }, bonus: { regen: 30 },
      },
      memberIds: [] as string[],
    }]
    const res = simulateBattle(left, right, createRng(3), { leftSyn: regenSyn })
    const heal = res.log.find(e => e.flags.includes('heal'))
    expect(heal).toBeDefined()
    expect(heal?.reason).toBeUndefined()
  })
})
