import { describe, it, expect } from 'vitest'
import { simulateBattle } from '@/game/engine/combat/simulate'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARD_BY_ID } from '@/data/wizards'
import type { DraftedWizard } from '@/types'

function team(ids: string[], seed: number): DraftedWizard[] {
  const r = createRng(seed)
  return ids.map(id => draftWizard(r, WIZARD_BY_ID[id]!))
}

describe('BattleResult.kills', () => {
  it('credits the winning side with one kill per enemy wiped', () => {
    // A strong left trio vs a single weak right unit so left cleanly wipes right.
    const left = team(['harry', 'ron', 'hermione'], 1)
    const right = team(['eloise'], 2)
    const res = simulateBattle(left, right, createRng('kill-seed'))
    expect(res.winner).toBe('left')
    expect(res.kills.left).toBe(right.length) // every enemy died to the player
    expect(res.kills.right).toBe(0) // player lost nobody
  })
})
