import { describe, it, expect } from 'vitest'
import { buildReplay } from '@/game/engine/combat/replay'
import { simulateBattle } from '@/game/engine/combat/simulate'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARD_BY_ID } from '@/data/wizards'
import type { DraftedWizard } from '@/types'

function team(ids: string[], seed = 1): DraftedWizard[] {
  const r = createRng(seed)
  return ids.map(id => draftWizard(r, WIZARD_BY_ID[id]!))
}

const LEFT_IDS = ['harry', 'ron', 'hermione', 'luna', 'neville']
const RIGHT_IDS = ['draco', 'crabbe', 'goyle', 'snape', 'bellatrix']

describe('buildReplay right-side menace parity', () => {
  it('replay right-side spd matches the menaced spd the sim actually used to order turns', () => {
    const l = team(LEFT_IDS, 7)
    const r = team(RIGHT_IDS, 13)
    const rightMenace = 0.5 // nonzero menace multiplier, mirrors a scripted-boss/elite fight

    const res = simulateBattle(l, r, createRng(42), { rightMenace })
    const replay = buildReplay(res, l, r, { rightMenace })

    const rightUnits = replay.units.filter(u => u.side === 'right')
    expect(rightUnits.length).toBe(RIGHT_IDS.length)

    // Every right-side unit's displayed (InitiativeBar-facing) spd must equal its
    // un-menaced base spd scaled by the SAME menace multiplier the sim used —
    // i.e. replay spd == sim spd, not the un-menaced base.
    for (const u of rightUnits) {
      const expectedSpd = Math.round(u.baseSpd * (1 + rightMenace))
      expect(u.spd).toBe(expectedSpd)
      // Sanity: menace actually changed something vs the un-menaced base.
      expect(u.spd).not.toBe(u.baseSpd)
    }
  })

  it('replay with zero menace matches replay with no rightMenace opt at all (backward compat)', () => {
    const l = team(LEFT_IDS, 7)
    const r = team(RIGHT_IDS, 13)
    const res = simulateBattle(l, r, createRng(42))
    const replayNoOpt = buildReplay(res, l, r)
    const replayZeroMenace = buildReplay(res, l, r, { rightMenace: 0 })

    const noOptRight = replayNoOpt.units.filter(u => u.side === 'right')
    const zeroRight = replayZeroMenace.units.filter(u => u.side === 'right')
    for (let i = 0; i < noOptRight.length; i++) {
      expect(zeroRight[i]!.spd).toBe(noOptRight[i]!.spd)
    }
  })
})
