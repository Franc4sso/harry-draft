import { it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { BattleArena } from '@/components/battle/BattleArena'
import { buildReplay, unitKey } from '@/game/engine/combat/replay'
import { simulateBattle } from '@/game/engine/combat/simulate'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARD_BY_ID } from '@/data/wizards'
import type { DraftedWizard, LogEntry } from '@/types'

// UnitBust's corner-bracket "[data-testid=target-reticle]" is gone (Task 11 — UnitBust
// deleted, replaced everywhere by WizardCard). The "who is targeted" signal moved to a
// red ring + glow on the whole card (BattleArena's `targeted && !acting` className) —
// a simpler treatment than the four-corner reticle, but the same information: this test
// now covers THAT signal instead of the deleted DOM node.
function team(ids: string[], seed = 1): DraftedWizard[] {
  const r = createRng(seed)
  return ids.map(id => draftWizard(r, WIZARD_BY_ID[id]!))
}
const left = () => team(['harry', 'ron', 'hermione', 'luna', 'neville'], 7)
const right = () => team(['draco', 'crabbe', 'goyle', 'snape', 'bellatrix'], 13)

it('draws a targeting ring on the chosen target', () => {
  const l = left(), r = right()
  const replay = buildReplay(simulateBattle(l, r, createRng(42)), l, r)
  const e: LogEntry = {
    turn: 1, actorId: 'harry', actorSide: 'left', action: 'Stupeficium',
    targetId: 'draco', targetSide: 'right', type: 'Attacco', value: 42, flags: [],
  }
  const { container } = render(<BattleArena replay={replay} hp={replay.frames[1]!.hp} entry={e} frameKey={1} />)
  const targetKey = unitKey('right', 'draco')
  const targetBust = container.querySelector(`[data-unit-key="${CSS.escape(targetKey)}"]`) as HTMLElement
  expect(targetBust.querySelector('.ring-rose-400')).not.toBeNull()
})

it('shows no targeting ring on a unit that is not the target', () => {
  const l = left(), r = right()
  const replay = buildReplay(simulateBattle(l, r, createRng(42)), l, r)
  const e: LogEntry = {
    turn: 1, actorId: 'harry', actorSide: 'left', action: 'Stupeficium',
    targetId: 'draco', targetSide: 'right', type: 'Attacco', value: 42, flags: [],
  }
  const { container } = render(<BattleArena replay={replay} hp={replay.frames[1]!.hp} entry={e} frameKey={1} />)
  const bystanderKey = unitKey('right', 'crabbe')
  const bystander = container.querySelector(`[data-unit-key="${CSS.escape(bystanderKey)}"]`) as HTMLElement
  expect(bystander.querySelector('.ring-rose-400')).toBeNull()
})
