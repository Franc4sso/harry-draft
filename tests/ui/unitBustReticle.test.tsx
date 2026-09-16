import { it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BattleArena } from '@/components/battle/BattleArena'
import { buildReplay, unitKey } from '@/game/engine/combat/replay'
import { simulateBattle } from '@/game/engine/combat/simulate'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARD_BY_ID } from '@/data/wizards'
import type { DraftedWizard, LogEntry } from '@/types'

// UnitBust's corner-bracket "[data-testid=target-reticle]" was gone even before this task
// (Task 11 — UnitBust deleted). Its Task 10 successor (a red ring + glow on the WizardCard
// among six identical cards) is ALSO gone as of Task 3 ("il palco"): there is no longer a
// "which of six cards is the target" question — the target IS the on-stage "bersaglio"
// duellante, the one big portrait in the gold `#target` slot from the mockup. This test now
// covers that signal: the targeted unit renders as the `bersaglio` duellante (gold border,
// per `role === 'bersaglio'` in Duellante.tsx), and a bystander gets no such treatment at
// all — it's just one of the six side miniatures, dimmed only if it happens to be on stage.
function team(ids: string[], seed = 1): DraftedWizard[] {
  const r = createRng(seed)
  return ids.map(id => draftWizard(r, WIZARD_BY_ID[id]!))
}
const left = () => team(['harry', 'ron', 'hermione', 'luna', 'neville'], 7)
const right = () => team(['draco', 'crabbe', 'goyle', 'snape', 'bellatrix'], 13)

it('renders the chosen target as the gold "bersaglio" duellante on stage', () => {
  const l = left(), r = right()
  const replay = buildReplay(simulateBattle(l, r, createRng(42)), l, r)
  const e: LogEntry = {
    turn: 1, actorId: 'harry', actorSide: 'left', action: 'Stupeficium',
    targetId: 'draco', targetSide: 'right', type: 'Attacco', value: 42, flags: [],
  }
  render(<BattleArena replay={replay} hp={replay.frames[1]!.hp} entry={e} frameKey={1} />)
  const targetKey = unitKey('right', 'draco')
  const targetSlot = screen.getByTestId('stage-bersaglio')
  const targetDuellante = targetSlot.querySelector(`[data-testid="duellante"][data-unit-key="${CSS.escape(targetKey)}"]`) as HTMLElement
  expect(targetDuellante).not.toBeNull()
  expect(targetDuellante.style.borderColor).toMatch(/gold/)
})

it('a bystander is only a side miniature, never the bersaglio duellante', () => {
  const l = left(), r = right()
  const replay = buildReplay(simulateBattle(l, r, createRng(42)), l, r)
  const e: LogEntry = {
    turn: 1, actorId: 'harry', actorSide: 'left', action: 'Stupeficium',
    targetId: 'draco', targetSide: 'right', type: 'Attacco', value: 42, flags: [],
  }
  render(<BattleArena replay={replay} hp={replay.frames[1]!.hp} entry={e} frameKey={1} />)
  const bystanderKey = unitKey('right', 'crabbe')
  expect(document.querySelector(`[data-testid="stage-bersaglio"] [data-unit-key="${CSS.escape(bystanderKey)}"]`)).toBeNull()
  const bystanderMini = document.querySelector(`[data-testid="miniatura"][data-unit-key="${CSS.escape(bystanderKey)}"]`)
  expect(bystanderMini).not.toBeNull()
})
