import { describe, it, expect } from 'vitest'
import { describeEntry } from '@/components/battle/BattleLog'

describe('fatigue log line', () => {
  it('reads as self-inflicted exhaustion, not a self-cast spell', () => {
    const line = describeEntry({
      turn: 20, action: 'Fatica',
      actorId: 'harry', actorSide: 'left',
      targetId: 'harry', targetSide: 'left',
      type: 'system', value: 12, flags: ['dot'],
    } as any, { 'left:harry': 'Harry' })
    expect(line).not.toMatch(/lancia Fatica/)
    expect(line).toMatch(/Sfinimento|Fatica/)
    expect(line).toMatch(/12/)
  })
})
