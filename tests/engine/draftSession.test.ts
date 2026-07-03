import { describe, it, expect, afterEach } from 'vitest'
import { startDraft, pickFrom } from '@/game/engine/draftSession'
import { setDraftPoolRestriction } from '@/game/engine/draft'
import { STARTER_WIZARDS } from '@/data/unlocks'
import { STARTER_PICKS } from '@/game/engine/runEngine'
import { BALANCE } from '@/data/constants'

const TEAM = BALANCE.draft.teamSize

describe('draftSession', () => {
  it('starts with a full first screen and no picks', () => {
    const s = startDraft('seed-a')
    expect(s.current).toHaveLength(5)
    expect(s.picks).toHaveLength(0)
    expect(s.screenIndex).toBe(0)
    expect(s.done).toBe(false)
  })
  it('rolled candidates carry stats and a spell', () => {
    const s = startDraft('seed-a')
    for (const c of s.current) {
      expect(c.stats.hp).toBeGreaterThan(0)
      expect(c.spell.id).toBeTruthy()
      expect(c.maxHp).toBe(c.stats.hp)
    }
  })
  it('picking advances and removes the shown options from the pool', () => {
    const s0 = startDraft('seed-a')
    const beforePool = s0.pool.length
    const s1 = pickFrom(s0, 0)
    expect(s1.picks).toHaveLength(1)
    expect(s1.picks[0]!.wizard.id).toBe(s0.current[0]!.wizard.id)
    expect(s1.pool.length).toBe(beforePool - s0.current.length)
    expect(s1.screenIndex).toBe(1)
    expect(s1.current).toHaveLength(5)
  })
  it('completes after teamSize picks', () => {
    let s = startDraft('seed-a')
    for (let i = 0; i < TEAM; i++) s = pickFrom(s, 0)
    expect(s.picks).toHaveLength(TEAM)
    expect(s.done).toBe(true)
    expect(s.current).toHaveLength(0)
  })
  it('is deterministic: same seed + same pick indices => same team', () => {
    const run = (seed: string) => {
      let s = startDraft(seed)
      const ids: string[] = []
      for (let i = 0; i < TEAM; i++) { ids.push(s.current[0]!.wizard.id); s = pickFrom(s, 0) }
      return ids
    }
    expect(run('zzz')).toEqual(run('zzz'))
  })
  it('a different pick choice does not change an earlier screen', () => {
    const s0 = startDraft('seed-b')
    const firstScreenIds = s0.current.map(c => c.wizard.id)
    const viaA = pickFrom(s0, 0)
    const viaB = pickFrom(s0, 1)
    // both came from the same screen 0 — that screen's shown ids are identical
    expect(viaA.screenIndex).toBe(1)
    expect(viaB.screenIndex).toBe(1)
    expect(firstScreenIds).toEqual(s0.current.map(c => c.wizard.id))
  })
})

describe('starter draft never exhausts the restricted pool', () => {
  afterEach(() => setDraftPoolRestriction(null))
  it('completes STARTER_PICKS picks without throwing across many seeds', () => {
    setDraftPoolRestriction(STARTER_WIZARDS)
    for (let i = 0; i < 80; i++) {
      let s = startDraft(`seed-${i}`, STARTER_PICKS)
      expect(() => {
        while (!s.done) s = pickFrom(s, 0) // always pick candidate 0
      }).not.toThrow()
      expect(s.picks.length).toBe(STARTER_PICKS)
    }
  })
})
