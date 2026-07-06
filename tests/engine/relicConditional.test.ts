import { describe, it, expect } from 'vitest'
import { applyRelicBonuses } from '@/game/engine/relics'
import type { ActiveRelic, DraftedWizard } from '@/types'

const dw = (id: string): DraftedWizard => ({
  wizard: { id, name: id, house: 'Grifondoro', role: 'Attaccante' } as any,
  stats: { hp: 100, atk: 10, def: 10, spd: 10 },
} as any)

describe('conditional + drawback', () => {
  it('applies teamSizeBelow bonus when team is small', () => {
    const relic: ActiveRelic = {
      relic: { id: 'c', name: 'C', desc: '', rarity: 'epica',
        conditional: { when: { kind: 'teamSizeBelow', value: 2 }, then: { allPct: 0.5 } } },
      stageObtained: 0,
    }
    const out = applyRelicBonuses({ hp: 100, atk: 10, def: 10, spd: 10 }, [dw('a')], [relic])
    expect(out.atk).toBe(15) // 10 * 1.5
  })
  it('does NOT apply when team is large enough', () => {
    const relic: ActiveRelic = {
      relic: { id: 'c', name: 'C', desc: '', rarity: 'epica',
        conditional: { when: { kind: 'teamSizeBelow', value: 2 }, then: { allPct: 0.5 } } },
      stageObtained: 0,
    }
    const out = applyRelicBonuses({ hp: 100, atk: 10, def: 10, spd: 10 }, [dw('a'), dw('b')], [relic])
    expect(out.atk).toBe(10)
  })
  it('applies drawback (negative bonus) always', () => {
    const relic: ActiveRelic = {
      relic: { id: 'd', name: 'D', desc: '', rarity: 'epica', bonus: { atk: 40 }, drawback: { hp: -60 } },
      stageObtained: 0,
    }
    const out = applyRelicBonuses({ hp: 100, atk: 10, def: 10, spd: 10 }, [dw('a')], [relic])
    expect(out.atk).toBe(50)
    expect(out.hp).toBe(40)
  })
})
