import { describe, it, expect } from 'vitest'
import { BALANCE } from '@/data/constants'

describe('shop constants', () => {
  // Onda 1.e (2026-07-25, Task 1): 'shop' removed from BALANCE.map.categoryWeights — the
  // map no longer generates shop nodes at all, so this assertion measured behaviour that
  // no longer exists. The BALANCE.shop constants block itself is untouched here (it's
  // removed in Task 2 along with this whole file); only the now-invalid categoryWeights
  // assertion is dropped.
  it('prices are all positive', () => {
    const s = BALANCE.shop
    for (const p of Object.values(s.relicByRarity)) expect(p).toBeGreaterThan(0)
    expect(s.heal).toBeGreaterThan(0)
    expect(s.removeWizard).toBeGreaterThan(0)
    expect(s.reroll).toBeGreaterThan(0)
  })
})
