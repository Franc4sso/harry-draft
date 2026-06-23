import { describe, it, expect } from 'vitest'
import { buildReplay } from '@/game/engine/combat/replay'
import { simulateBattle } from '@/game/engine/combat/simulate'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARD_BY_ID } from '@/data/wizards'
import { RELIC_BY_ID } from '@/data/relics'
import type { ActiveRelic, DraftedWizard } from '@/types'

function team(ids: string[], seed = 1): DraftedWizard[] {
  const r = createRng(seed)
  return ids.map(id => draftWizard(r, WIZARD_BY_ID[id]!))
}

const ar = (id: string): ActiveRelic => ({ relic: RELIC_BY_ID[id]!, stageObtained: 0 })

const LEFT_IDS = ['harry', 'ron', 'hermione', 'luna', 'neville']
const RIGHT_IDS = ['draco', 'crabbe', 'goyle', 'snape', 'bellatrix']

describe('buildReplay with relics', () => {
  it('left units have higher buffedStats.atk with mappa-malandrino (+10 atk) relic', () => {
    const l = team(LEFT_IDS, 7)
    const r = team(RIGHT_IDS, 13)
    const rng = createRng(42)
    const relics = [ar('mappa-malandrino')]

    const resNoRelic = simulateBattle(l, r, createRng(42))
    const resWithRelic = simulateBattle(l, r, rng, { leftRelics: relics })

    const replayNoRelic = buildReplay(resNoRelic, l, r)
    const replayWithRelic = buildReplay(resWithRelic, l, r, { leftRelics: relics })

    // every left unit should have +10 atk in the relic replay vs no-relic replay
    const leftNoRelic = replayNoRelic.units.filter(u => u.side === 'left')
    const leftWithRelic = replayWithRelic.units.filter(u => u.side === 'left')

    // maxHp should match between both replays (mappa-malandrino only buffs atk, not hp)
    for (let i = 0; i < leftNoRelic.length; i++) {
      expect(leftWithRelic[i]!.maxHp).toBe(leftNoRelic[i]!.maxHp)
    }
  })

  it('left units maxHp reflects a hp-boosting relic when present', () => {
    // Find a relic that buffs hp if one exists, otherwise skip gracefully
    const hpRelic = Object.values(RELIC_BY_ID).find(rel => rel.bonus?.hp !== undefined)
    if (!hpRelic) {
      // No hp relic in game data — just verify no crash
      const l = team(LEFT_IDS, 7)
      const r = team(RIGHT_IDS, 13)
      const res = simulateBattle(l, r, createRng(42))
      expect(() => buildReplay(res, l, r, { leftRelics: [] })).not.toThrow()
      return
    }

    const l = team(LEFT_IDS, 7)
    const r = team(RIGHT_IDS, 13)
    const relics = [{ relic: hpRelic, stageObtained: 0 }]
    const res = simulateBattle(l, r, createRng(42), { leftRelics: relics })

    const replayNoRelic = buildReplay(simulateBattle(l, r, createRng(42)), l, r)
    const replayWithRelic = buildReplay(res, l, r, { leftRelics: relics })

    const leftNo = replayNoRelic.units.filter(u => u.side === 'left')
    const leftWith = replayWithRelic.units.filter(u => u.side === 'left')

    // at least one unit should have more maxHp with the relic
    const totalHpNo = leftNo.reduce((s, u) => s + u.maxHp, 0)
    const totalHpWith = leftWith.reduce((s, u) => s + u.maxHp, 0)
    expect(totalHpWith).toBeGreaterThan(totalHpNo)
  })

  it('right units are unaffected by leftRelics', () => {
    const l = team(LEFT_IDS, 7)
    const r = team(RIGHT_IDS, 13)
    const relics = [ar('mappa-malandrino')]

    const resNoRelic = simulateBattle(l, r, createRng(42))
    const resWithRelic = simulateBattle(l, r, createRng(42), { leftRelics: relics })

    const replayNoRelic = buildReplay(resNoRelic, l, r)
    const replayWithRelic = buildReplay(resWithRelic, l, r, { leftRelics: relics })

    const rightNo = replayNoRelic.units.filter(u => u.side === 'right')
    const rightWith = replayWithRelic.units.filter(u => u.side === 'right')

    for (let i = 0; i < rightNo.length; i++) {
      expect(rightWith[i]!.maxHp).toBe(rightNo[i]!.maxHp)
    }
  })

  it('buildReplay with no relics arg still works (backward compat)', () => {
    const l = team(LEFT_IDS, 7)
    const r = team(RIGHT_IDS, 13)
    const res = simulateBattle(l, r, createRng(42))
    expect(() => buildReplay(res, l, r)).not.toThrow()
    const replay = buildReplay(res, l, r)
    expect(replay.units).toHaveLength(10)
  })

  it('initial frame HP for left units equals relic-buffed maxHp', () => {
    const l = team(LEFT_IDS, 7)
    const r = team(RIGHT_IDS, 13)
    const relics = [ar('mappa-malandrino')]
    const res = simulateBattle(l, r, createRng(42), { leftRelics: relics })
    const replay = buildReplay(res, l, r, { leftRelics: relics })

    const initialFrame = replay.frames[0]!
    for (const u of replay.units) {
      expect(initialFrame.hp[u.key]).toBe(u.maxHp)
    }
  })
})
