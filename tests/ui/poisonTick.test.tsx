import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { floatFor } from '@/components/battle/damageFloat'
import { BattleArena } from '@/components/battle/BattleArena'
import { buildReplay, unitKey } from '@/game/engine/combat/replay'
import { simulateBattle } from '@/game/engine/combat/simulate'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARD_BY_ID } from '@/data/wizards'
import type { DraftedWizard, LogEntry } from '@/types'

it('un tick veleno ha tono dot (non damage)', () => {
  const f = floatFor({ turn: 1, action: 'Veleno', type: 'Controllo', value: 9, flags: ['dot'], actorId: 'a', targetId: 'b' } as any)
  expect(f).toEqual({ text: '-9', tone: 'dot' })
})

it('un colpo normale resta tono damage', () => {
  const f = floatFor({ turn: 1, action: 'Colpo', type: 'Attacco', value: 12, flags: [], actorId: 'a', targetId: 'b' } as any)
  expect(f?.tone).toBe('damage')
})

// UnitBust's colored flash overlay ([data-impact]) is gone (Task 11 — UnitBust deleted).
// The dot/damage color distinction survives on the floating number itself
// (BattleArena's [data-testid=damage-float], text-green-300 for dot vs text-rose-300 for
// damage) — this covers that successor instead of the deleted overlay.
function team(ids: string[], seed = 1): DraftedWizard[] {
  const r = createRng(seed)
  return ids.map(id => draftWizard(r, WIZARD_BY_ID[id]!))
}

describe('BattleArena: il colore del numero fluttuante segue il tono', () => {
  it('un tick veleno (tono dot) mostra il numero in verde, non nel rosso da attacco', () => {
    const l = team(['harry', 'ron', 'hermione', 'luna', 'neville'], 7)
    const r = team(['draco', 'crabbe', 'goyle', 'snape', 'bellatrix'], 13)
    const replay = buildReplay(simulateBattle(l, r, createRng(42)), l, r)
    const e: LogEntry = {
      turn: 1, actorId: 'harry', actorSide: 'left', action: 'Veleno',
      targetId: 'draco', targetSide: 'right', type: 'Controllo', value: 9, flags: ['dot'],
    }
    const { container } = render(<BattleArena replay={replay} hp={replay.frames[1]!.hp} entry={e} frameKey={1} />)
    const targetKey = unitKey('right', 'draco')
    const targetBust = container.querySelector(`[data-unit-key="${CSS.escape(targetKey)}"]`) as HTMLElement
    const float = targetBust.querySelector('[data-testid="damage-float"]')!
    expect(float.className).toMatch(/text-green-300/)
    expect(float.className).not.toMatch(/text-rose-300/)
  })
})
