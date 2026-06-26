import { describe, it, expect } from 'vitest'
import { offerRecruits, recruitVia, replaceMember } from '@/game/engine/recruit'
import { createRng } from '@/game/engine/rng'
import { BALANCE } from '@/data/constants'
import { createDraftPool } from '@/game/engine/draft'

describe('recruit', () => {
  it('offers exactly offerSize distinct candidates', () => {
    for (let s = 0; s < 30; s++) {
      const offer = offerRecruits(createRng(s), { house: 'Tassorosso', exclude: new Set() })
      expect(offer).toHaveLength(BALANCE.recruit.offerSize)
      expect(new Set(offer.map(o => o.wizard.id)).size).toBe(offer.length)
    }
  })
  it('guarantees at least houseGuarantee of the chosen house', () => {
    for (let s = 0; s < 30; s++) {
      const offer = offerRecruits(createRng(s), { house: 'Serpeverde', exclude: new Set() })
      const fromHouse = offer.filter(o => o.wizard.house === 'Serpeverde').length
      expect(fromHouse).toBeGreaterThanOrEqual(BALANCE.recruit.houseGuarantee)
    }
  })
  it('never offers an excluded wizard', () => {
    const excludeId = offerRecruits(createRng(1), { house: 'Corvonero', exclude: new Set() })[0]!.wizard.id
    for (let s = 0; s < 30; s++) {
      const offer = offerRecruits(createRng(s), { house: 'Corvonero', exclude: new Set([excludeId]) })
      expect(offer.some(o => o.wizard.id === excludeId)).toBe(false)
    }
  })
  it('is deterministic per seed', () => {
    const a = offerRecruits(createRng(7), { house: 'Grifondoro', exclude: new Set() }).map(o => o.wizard.id)
    const b = offerRecruits(createRng(7), { house: 'Grifondoro', exclude: new Set() }).map(o => o.wizard.id)
    expect(a).toEqual(b)
  })
  it('recruitVia sets provenance and initializes progression', () => {
    const base = offerRecruits(createRng(2), { house: 'Tassorosso', exclude: new Set() })[0]!
    const r = recruitVia(base, 'Elite')
    expect(r.recruitedVia).toBe('Elite')
    expect(r.level).toBe(1)
    expect(r.exp).toBe(0)
    expect(r.growthChoices).toEqual([])
  })
  it('throws when the pool cannot fill the offer', () => {
    const all = new Set(createDraftPool().map(w => w.id))
    expect(() => offerRecruits(createRng(1), { house: 'Grifondoro', exclude: all })).toThrow(/pool exhausted/)
  })
  it('replaceMember swaps the targeted member, preserving order length', () => {
    const team = offerRecruits(createRng(3), { house: 'Grifondoro', exclude: new Set() })
    const incoming = offerRecruits(createRng(99), { house: 'Serpeverde', exclude: new Set(team.map(t => t.wizard.id)) })[0]!
    const out = replaceMember(team, team[1]!.wizard.id, incoming)
    expect(out).toHaveLength(team.length)
    expect(out.some(t => t.wizard.id === team[1]!.wizard.id)).toBe(false)
    expect(out.some(t => t.wizard.id === incoming.wizard.id)).toBe(true)
  })
})
