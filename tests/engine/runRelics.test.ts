import { describe, it, expect } from 'vitest'
import { startRun, addRelic, relicOfferRngChannel } from '@/game/engine/run'
import { RELICS } from '@/data/relics'

describe('run relics', () => {
  it('startRun initializes empty relics', () => {
    expect(startRun('s').relics).toEqual([])
  })
  it('relicOfferRngChannel is a distinct channel', () => {
    expect(relicOfferRngChannel).toBe(3)
  })
  it('addRelic appends immutably with the current stage', () => {
    const s0 = { ...startRun('s'), stage: 2 }
    const s1 = addRelic(s0, RELICS[0]!)
    expect(s1.relics).toHaveLength(1)
    expect(s1.relics[0]!.relic.id).toBe(RELICS[0]!.id)
    expect(s1.relics[0]!.stageObtained).toBe(2)
    expect(s0.relics).toHaveLength(0) // original untouched
  })
})
