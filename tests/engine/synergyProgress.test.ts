import { describe, it, expect } from 'vitest'
import { synergyProgress } from '@/game/engine/synergy'
import type { DraftedWizard } from '@/types'

const dw = (id: string, tags: string[] = []): DraftedWizard =>
  ({ wizard: { id, role: 'Attaccante', house: 'Serpeverde', tags }, level: 1 } as unknown as DraftedWizard)

describe('synergyProgress', () => {
  it('espone have/need/active per ogni sinergia, ANCHE sotto soglia', () => {
    const two = [dw('a', ['veleno']), dw('b', ['veleno'])]
    const tox = synergyProgress(two).find(p => p.synergy.id === 'tossicita')!
    expect(tox.have).toBe(2); expect(tox.need).toBe(3); expect(tox.active).toBe(false)
  })
  it('active=true a soglia', () => {
    const three = [dw('a', ['veleno']), dw('b', ['veleno']), dw('c', ['veleno'])]
    const tox = synergyProgress(three).find(p => p.synergy.id === 'tossicita')!
    expect(tox.have).toBe(3); expect(tox.active).toBe(true)
    expect(tox.memberIds).toHaveLength(3)
  })
  it('have=0 quando nessun mago ha il tag', () => {
    const none = [dw('a'), dw('b')]
    const bas = synergyProgress(none).find(p => p.synergy.id === 'bastione')!
    expect(bas.have).toBe(0); expect(bas.active).toBe(false)
  })
})
