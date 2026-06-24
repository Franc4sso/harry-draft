import { describe, it, expect } from 'vitest'
import { buildReplay, unitKey } from '@/game/engine/combat/replay'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARD_BY_ID } from '@/data/wizards'
import type { BattleResult, DraftedWizard } from '@/types'

function team(ids: string[], seed = 1): DraftedWizard[] {
  const r = createRng(seed)
  return ids.map(id => draftWizard(r, WIZARD_BY_ID[id]!))
}

const LEFT_IDS = ['harry', 'ron', 'hermione', 'luna', 'neville']
const RIGHT_IDS = ['draco', 'crabbe', 'goyle', 'snape', 'bellatrix']

/** Minimal BattleResult: we only ever inspect frame 0, so an empty log is fine. */
const emptyResult: BattleResult = {
  winner: 'left',
  turns: 0,
  log: [],
  mvpId: 'harry',
  finalSnapshot: [],
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
