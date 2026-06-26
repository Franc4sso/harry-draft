import { describe, it, expect } from 'vitest'
import { menacePctFor } from '@/game/engine/run'
import { BALANCE } from '@/data/constants'

describe('menacePctFor', () => {
  it('is gentle early and steep late', () => {
    const early = menacePctFor(0, 'normal')
    const late = menacePctFor(5, 'normal')
    expect(early).toBeCloseTo(BALANCE.campaign.menaceBase)
    expect(late).toBeGreaterThan(early)
  })
  it('elite and boss multiply the menace', () => {
    const normal = menacePctFor(3, 'normal')
    expect(menacePctFor(3, 'elite')).toBeCloseTo(normal * BALANCE.campaign.menaceEliteMult)
    expect(menacePctFor(3, 'boss')).toBeCloseTo(normal * BALANCE.campaign.menaceBossMult)
  })
})
