import { describe, it, expect } from 'vitest'
import { RELICS, RELIC_BY_ID } from '@/data/relics'

describe('redesigned relics remain well-formed', () => {
  it('mappa-malandrino keeps a reduced flat atk bonus and gains an execute grant', () => {
    const r = RELIC_BY_ID['mappa-malandrino']!
    expect(r).toBeTruthy()
    expect(r.bonus).toEqual({ atk: 6 })
    expect(r.keywords).toContain('esecuzione')
    expect(r.grantsExecute).toEqual({ threshold: 0.5, bonus: 0.12 })
    expect(r.desc).toMatch(/esecuzione|sotto il/i)
  })

  it('ricordatutto pays for its onBattleStart shield with a reduced flat def/spd bonus', () => {
    const r = RELIC_BY_ID['ricordatutto']!
    expect(r).toBeTruthy()
    expect(r.bonus).toEqual({ def: 6, spd: 6 })
    expect(r.triggers).toEqual([
      { hook: 'onBattleStart', effects: [{ kind: 'shield', amount: 10 }] },
    ])
    expect(r.desc).toMatch(/scudo/i)
  })

  it('giratempo still exists with a spd component (redesign reverted if not cleanly expressible)', () => {
    const r = RELICS.find(x => x.id === 'giratempo')!
    expect(r).toBeTruthy()
    expect(r.bonus?.spd).toBeGreaterThan(0)
    expect(r.desc).toMatch(/velocità/i)
  })
})
