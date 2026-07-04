import { describe, it, expect } from 'vitest'
import { buildReplay, unitKey } from '@/game/engine/combat/replay'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARD_BY_ID } from '@/data/wizards'
import { RELIC_BY_ID } from '@/data/relics'
import type { ActiveRelic, BattleResult, DraftedWizard } from '@/types'

function team(ids: string[], seed = 1): DraftedWizard[] {
  const r = createRng(seed)
  return ids.map(id => draftWizard(r, WIZARD_BY_ID[id]!))
}

const ar = (id: string): ActiveRelic => ({ relic: RELIC_BY_ID[id]!, stageObtained: 0 })

const LEFT_IDS = ['harry', 'ron', 'hermione', 'luna', 'neville']
const RIGHT_IDS = ['draco', 'crabbe', 'goyle', 'snape', 'bellatrix']

/** Minimal BattleResult: we only ever inspect frame 0, so an empty log is fine. */
const emptyResult: BattleResult = {
  winner: 'left',
  turns: 0,
  log: [],
  mvpId: 'harry',
  finalSnapshot: [],
  snapshots: [],
  timedOut: false,
  kills: { left: 0, right: 0 },
}

describe('buildReplay frame 0 seeds from wound-aware HP', () => {
  it('seeds a wounded left unit at its currentHp, not maxHp', () => {
    const l = team(LEFT_IDS, 7)
    const r = team(RIGHT_IDS, 13)
    // Wound the first left unit: currentHp strictly below its maxHp.
    const wounded = l[0]!
    const woundedHp = Math.floor(wounded.maxHp / 2)
    expect(woundedHp).toBeLessThan(wounded.maxHp)
    l[0] = { ...wounded, currentHp: woundedHp }

    const replay = buildReplay(emptyResult, l, r)
    const key = unitKey('left', wounded.wizard.id)

    // No buffs in play, so the wound-aware start HP is exactly currentHp.
    expect(replay.frames[0]!.hp[key]).toBe(woundedHp)
    expect(replay.frames[0]!.hp[key]).not.toBe(wounded.maxHp)
  })

  it('seeds a fresh unit (no currentHp) at its maxHp', () => {
    const l = team(LEFT_IDS, 7)
    const r = team(RIGHT_IDS, 13)
    // Wound only the first unit; the rest stay fresh.
    const wounded = l[0]!
    l[0] = { ...wounded, currentHp: Math.floor(wounded.maxHp / 2) }

    const replay = buildReplay(emptyResult, l, r)
    const fresh = l[1]!
    const key = unitKey('left', fresh.wizard.id)
    const freshUnit = replay.units.find(u => u.key === key)!

    expect(fresh.currentHp).toBeUndefined()
    expect(replay.frames[0]!.hp[key]).toBe(freshUnit.maxHp)
  })
})

describe('buildReplay populates base + buffed atk/def/spd', () => {
  it('an unbuffed unit has atk===baseAtk===stats.atk (and same for def/spd)', () => {
    const l = team(LEFT_IDS, 7)
    const r = team(RIGHT_IDS, 13)
    const replay = buildReplay(emptyResult, l, r)

    const dw = l[0]!
    const key = unitKey('left', dw.wizard.id)
    const ru = replay.units.find(u => u.key === key)!

    expect(ru.atk).toBe(dw.stats.atk)
    expect(ru.baseAtk).toBe(dw.stats.atk)
    expect(ru.atk).toBe(ru.baseAtk)

    expect(ru.def).toBe(dw.stats.def)
    expect(ru.baseDef).toBe(dw.stats.def)
    expect(ru.def).toBe(ru.baseDef)

    expect(ru.spd).toBe(dw.stats.spd)
    expect(ru.baseSpd).toBe(dw.stats.spd)
    expect(ru.spd).toBe(ru.baseSpd)
  })

  it('a relic-buffed unit has atk strictly greater than baseAtk (+10 mappa-malandrino)', () => {
    const l = team(LEFT_IDS, 7)
    const r = team(RIGHT_IDS, 13)
    const relics = [ar('mappa-malandrino')]
    const replay = buildReplay(emptyResult, l, r, { leftRelics: relics })

    const dw = l[0]!
    const key = unitKey('left', dw.wizard.id)
    const ru = replay.units.find(u => u.key === key)!

    // mappa-malandrino: +10 atk, no def/spd change.
    expect(ru.baseAtk).toBe(dw.stats.atk)
    expect(ru.atk).toBe(dw.stats.atk + 10)
    expect(ru.atk).toBeGreaterThan(ru.baseAtk)

    // def/spd untouched by this relic.
    expect(ru.def).toBe(ru.baseDef)
    expect(ru.spd).toBe(ru.baseSpd)
  })
})
