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
// among six identical cards) was replaced by Task 3's ("il palco") gold/red-bordered
// "bersaglio" Duellante — which was ITSELF rejected by the user on screen — "fa totalmente
// schifo" — and replaced by Task 5 ("la scena, composta") with ten equal-size CartaCombat
// cards. There is no longer a separate big "duellante" element or a `stage-bersaglio` slot:
// the target IS one of the ten cards, marked by its own `data-ruolo="bersaglio"` attribute
// (which drives the red corner treatment in vetrata.css, `.carta-combat[data-ruolo=
// 'bersaglio']`) plus the `✖ COLPITA` ribbon above it. This test now covers that signal
// directly on the card, and a bystander gets neither the attribute nor the ribbon.
function team(ids: string[], seed = 1): DraftedWizard[] {
  const r = createRng(seed)
  return ids.map(id => draftWizard(r, WIZARD_BY_ID[id]!))
}
const left = () => team(['harry', 'ron', 'hermione', 'luna', 'neville'], 7)
const right = () => team(['draco', 'crabbe', 'goyle', 'snape', 'bellatrix'], 13)

it('renders the chosen target as the "bersaglio" card, with the COLPITA ribbon', () => {
  const l = left(), r = right()
  const replay = buildReplay(simulateBattle(l, r, createRng(42)), l, r)
  const e: LogEntry = {
    turn: 1, actorId: 'harry', actorSide: 'left', action: 'Stupeficium',
    targetId: 'draco', targetSide: 'right', type: 'Attacco', value: 42, flags: [],
  }
  render(<BattleArena replay={replay} hp={replay.frames[1]!.hp} entry={e} frameKey={1} />)
  const targetKey = unitKey('right', 'draco')
  const targetCard = document.querySelector(`[data-testid="carta-combat"][data-unit-key="${CSS.escape(targetKey)}"]`) as HTMLElement
  expect(targetCard).not.toBeNull()
  expect(targetCard.getAttribute('data-ruolo')).toBe('bersaglio')
  const wrapper = targetCard.closest('.relative') as HTMLElement
  expect(wrapper.querySelector('.tab-colpita')).not.toBeNull()
})

it('a bystander is just another card, never the bersaglio', () => {
  const l = left(), r = right()
  const replay = buildReplay(simulateBattle(l, r, createRng(42)), l, r)
  const e: LogEntry = {
    turn: 1, actorId: 'harry', actorSide: 'left', action: 'Stupeficium',
    targetId: 'draco', targetSide: 'right', type: 'Attacco', value: 42, flags: [],
  }
  render(<BattleArena replay={replay} hp={replay.frames[1]!.hp} entry={e} frameKey={1} />)
  const bystanderKey = unitKey('right', 'crabbe')
  const bystanderCard = document.querySelector(`[data-testid="carta-combat"][data-unit-key="${CSS.escape(bystanderKey)}"]`) as HTMLElement
  expect(bystanderCard).not.toBeNull()
  expect(bystanderCard.getAttribute('data-ruolo')).not.toBe('bersaglio')
  const wrapper = bystanderCard.closest('.relative') as HTMLElement
  expect(wrapper.querySelector('.tab-colpita')).toBeNull()
})
