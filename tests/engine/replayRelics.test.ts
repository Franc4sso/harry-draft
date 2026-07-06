import { describe, it, expect } from 'vitest'
import { buildReplay } from '@/game/engine/combat/replay'
import { simulateBattle, toBattleUnits } from '@/game/engine/combat/simulate'
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
  it('left units have higher buffedStats.atk with mappa-malandrino (+6 atk, Task 10 redesign) relic', () => {
    const l = team(LEFT_IDS, 7)
    const r = team(RIGHT_IDS, 13)
    const relics = [ar('mappa-malandrino')]

    // assert buffedStats.atk is +6 for every left unit when the relic is active
    const unitsNoRelic = toBattleUnits(l, 'left', [])
    const unitsWithRelic = toBattleUnits(l, 'left', [], relics)
    for (let i = 0; i < unitsNoRelic.length; i++) {
      expect(unitsWithRelic[i]!.buffedStats.atk).toBe(unitsNoRelic[i]!.buffedStats.atk + 6)
    }

    // replay: mappa-malandrino does not buff hp, so maxHp should be unchanged
    const resNoRelic = simulateBattle(l, r, createRng(42))
    const resWithRelic = simulateBattle(l, r, createRng(42), { leftRelics: relics })
    const replayNoRelic = buildReplay(resNoRelic, l, r)
    const replayWithRelic = buildReplay(resWithRelic, l, r, { leftRelics: relics })
    const leftNoRelic = replayNoRelic.units.filter(u => u.side === 'left')
    const leftWithRelic = replayWithRelic.units.filter(u => u.side === 'left')
    for (let i = 0; i < leftNoRelic.length; i++) {
      expect(leftWithRelic[i]!.maxHp).toBe(leftNoRelic[i]!.maxHp)
    }
  })

  it('left units maxHp is higher with pozione-fortuna (+5% all stats) relic', () => {
    // pozione-fortuna has allPct: 0.05, which scales all stats including hp
    const l = team(LEFT_IDS, 7)
    const r = team(RIGHT_IDS, 13)
    const relics = [ar('pozione-fortuna')]

    const resNoRelic = simulateBattle(l, r, createRng(42))
    const resWithRelic = simulateBattle(l, r, createRng(42), { leftRelics: relics })

    const replayNoRelic = buildReplay(resNoRelic, l, r)
    const replayWithRelic = buildReplay(resWithRelic, l, r, { leftRelics: relics })

    const leftNo = replayNoRelic.units.filter(u => u.side === 'left')
    const leftWith = replayWithRelic.units.filter(u => u.side === 'left')

    // every left unit should have more maxHp with the +5% all-stats relic
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
