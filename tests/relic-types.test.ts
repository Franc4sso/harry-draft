import { describe, it, expect } from 'vitest'
import type { Relic, ActiveRelic } from '@/types'

describe('relic types', () => {
  it('compose into a valid relic and active relic', () => {
    const relic: Relic = {
      id: 'r', name: 'R', desc: '', rarity: 'comune',
      bonus: { atk: 10 }, condition: { house: 'Grifondoro', count: 3 },
    }
    const active: ActiveRelic = { relic, stageObtained: 2 }
    expect(active.relic.bonus?.atk).toBe(10)
    expect(active.stageObtained).toBe(2)
  })
  it('supports trigger effect specs', () => {
    const epic: Relic = {
      id: 'e', name: 'E', desc: '', rarity: 'epica',
      startOfBattle: [{ kind: 'shield', amount: 20 }],
      onHit: [{ kind: 'applyStatus', target: 'enemy', chance: 0.15, effect: { kind: 'dot', amount: 6, duration: 2 } }],
    }
    expect(epic.startOfBattle?.[0]?.kind).toBe('shield')
  })
})
