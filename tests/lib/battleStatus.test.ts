import { describe, it, expect } from 'vitest'
import { statusesAt } from '@/lib/battleStatus'
import { buildReplay, unitKey } from '@/game/engine/combat/replay'
import { simulateBattle } from '@/game/engine/combat/simulate'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARD_BY_ID } from '@/data/wizards'
import type { DraftedWizard } from '@/types'

function team(ids: string[], seed = 1): DraftedWizard[] {
  const r = createRng(seed)
  return ids.map(id => draftWizard(r, WIZARD_BY_ID[id]!))
}

describe('statusesAt', () => {
  const l = team(['harry', 'ron', 'hermione', 'luna', 'neville'], 7)
  const r = team(['draco', 'crabbe', 'goyle', 'snape', 'bellatrix'], 13)
  const replay = buildReplay(simulateBattle(l, r, createRng(42)), l, r)

  it('returns an empty map at the initial frame', () => {
    expect(statusesAt(replay, 0)).toEqual({})
  })
  it('returns only known tokens for any frame', () => {
    const last = replay.frames.length - 1
    const map = statusesAt(replay, last)
    for (const tokens of Object.values(map)) {
      for (const t of tokens) expect(['dot', 'stun', 'shield']).toContain(t)
    }
  })
  it('does not mutate the replay', () => {
    const before = JSON.stringify(replay.frames.length)
    statusesAt(replay, 3)
    expect(JSON.stringify(replay.frames.length)).toBe(before)
  })
})
