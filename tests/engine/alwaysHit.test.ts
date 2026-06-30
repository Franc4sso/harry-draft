import { describe, it, expect } from 'vitest'
import { teamAlwaysHit } from '@/game/engine/alwaysHit'
import type { ActiveRelic, DraftedWizard } from '@/types'

function mkDw(id: string, tier: 1 | 2 | 3 | 4, tags?: string[]): DraftedWizard {
  return {
    wizard: {
      id, name: id, house: 'Grifondoro', role: 'Attaccante', tier, gender: 'm',
      ranges: {
        hp: [100, 100] as const, atk: [10, 10] as const,
        def: [10, 10] as const, spd: [10, 10] as const,
      },
      spellPool: [],
      tags,
    },
    stats: { hp: 100, atk: 10, def: 10, spd: 10 },
    maxHp: 100,
    spell: {} as any,
  }
}

const noRelics: ActiveRelic[] = []

describe('teamAlwaysHit', () => {
  it('returns empty set when no source', () => {
    const team = [mkDw('a', 2)]
    expect(teamAlwaysHit(team, noRelics).size).toBe(0)
  })

  it('infallibile tag + tier >= 2 wizard → id in set', () => {
    const team = [mkDw('mira', 2, ['infallibile'])]
    const ids = teamAlwaysHit(team, noRelics)
    expect(ids.has('mira')).toBe(true)
    expect(ids.size).toBe(1)
  })

  it('infallibile tag at tier 3 (also >= 2) → id in set', () => {
    const team = [mkDw('mira', 3, ['infallibile'])]
    const ids = teamAlwaysHit(team, noRelics)
    expect(ids.has('mira')).toBe(true)
  })

  it('infallibile tag but tier === 1 → id NOT in set (tier guard)', () => {
    const team = [mkDw('mira', 1, ['infallibile'])]
    const ids = teamAlwaysHit(team, noRelics)
    expect(ids.has('mira')).toBe(false)
    expect(ids.size).toBe(0)
  })

  it('tag that is not infallibile (tier 2) → not in set', () => {
    const team = [mkDw('x', 2, ['esecuzione'])]
    expect(teamAlwaysHit(team, noRelics).size).toBe(0)
  })

  it('grantsAlwaysHit relic → ALL team ids in set', () => {
    const team = [mkDw('a', 1), mkDw('b', 2)]
    const relic: ActiveRelic = {
      relic: { id: 'occhio-magico', name: 'Occhio Magico', desc: '', rarity: 'epica', grantsAlwaysHit: true },
      stageObtained: 0,
    }
    const ids = teamAlwaysHit(team, [relic])
    expect(ids.has('a')).toBe(true)
    expect(ids.has('b')).toBe(true)
    expect(ids.size).toBe(2)
  })

  it('relic without grantsAlwaysHit → no effect', () => {
    const team = [mkDw('a', 2)]
    const relic: ActiveRelic = {
      relic: { id: 'spada', name: 'Spada', desc: '', rarity: 'rara', grantsExecute: { threshold: 0.3, bonus: 0.4 } },
      stageObtained: 0,
    }
    expect(teamAlwaysHit(team, [relic]).size).toBe(0)
  })

  it('tag + relic combined: union of ids', () => {
    const tagged = mkDw('mira', 2, ['infallibile'])
    const plain = mkDw('plain', 1)
    const relic: ActiveRelic = {
      relic: { id: 'occhio-magico', name: 'Occhio Magico', desc: '', rarity: 'epica', grantsAlwaysHit: true },
      stageObtained: 0,
    }
    const ids = teamAlwaysHit([tagged, plain], [relic])
    // relic grants both; tag also covers mira
    expect(ids.has('mira')).toBe(true)
    expect(ids.has('plain')).toBe(true)
    expect(ids.size).toBe(2)
  })
})
