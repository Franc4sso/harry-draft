import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WizardCard } from '@/components/cards/WizardCard'
import { buildReplay, unitKey } from '@/game/engine/combat/replay'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARD_BY_ID } from '@/data/wizards'
import type { BattleResult, DraftedWizard } from '@/types'

const drafted = () => draftWizard(createRng(1), WIZARD_BY_ID['harry']!)

function team(ids: string[], seed = 1): DraftedWizard[] {
  const r = createRng(seed)
  return ids.map(id => draftWizard(r, WIZARD_BY_ID[id]!))
}

/** Minimal BattleResult: only frame 0 (built from the units themselves) is inspected. */
const emptyResult: BattleResult = {
  winner: 'left',
  turns: 0,
  log: [],
  mvpId: 'harry',
  finalSnapshot: [],
  snapshots: [],
  timedOut: false,
  kills: { left: 0, right: 0 },
  alliesLost: 0,
}

// Le tre vecchie carte (WizardCardColumn/WizardCardRow/UnitBust) sono state sostituite
// dall'unica WizardCard (density full/row/combat) — vedi Task 11. Il badge Corrotto vive
// ora su WizardCard stessa, per tutte e tre le densità.
describe('Corrotto badge (WizardCard)', () => {
  it('density full: mostra il badge quando corrotto=true, con testo "non curabile"', () => {
    render(<WizardCard drafted={{ ...drafted(), corrotto: true }} density="full" />)
    const badge = screen.getByTestId('corrotto-badge')
    expect(badge).toHaveTextContent(/corrotto/i)
    expect(badge).toHaveTextContent(/non curabile/i)
  })

  it('density full: nessun badge quando non corrotto', () => {
    render(<WizardCard drafted={drafted()} density="full" />)
    expect(screen.queryByTestId('corrotto-badge')).toBeNull()
  })

  it('density row (roster/mappa): mostra il badge quando corrotto=true', () => {
    render(<WizardCard drafted={{ ...drafted(), corrotto: true }} density="row" />)
    const badge = screen.getByTestId('corrotto-badge')
    expect(badge).toHaveTextContent(/corrotto/i)
    expect(badge).toHaveTextContent(/non curabile/i)
  })

  it('density row: nessun badge quando non corrotto', () => {
    render(<WizardCard drafted={drafted()} density="row" />)
    expect(screen.queryByTestId('corrotto-badge')).toBeNull()
  })

  it('buildReplay: porta corrotto=true dal DraftedWizard al ReplayUnit', () => {
    const l = team(['harry', 'ron', 'hermione', 'luna', 'neville'], 7)
    const r = team(['draco', 'crabbe', 'goyle', 'snape', 'bellatrix'], 13)
    l[0] = { ...l[0]!, corrotto: true }

    const replay = buildReplay(emptyResult, l, r)
    const key = unitKey('left', l[0]!.wizard.id)
    const unit = replay.units.find(u => u.key === key)!
    expect(unit.corrotto).toBe(true)

    // Only the marked unit carries it — no bleed onto the rest of the team.
    const other = replay.units.find(u => u.key === unitKey('left', l[1]!.wizard.id))!
    expect(other.corrotto).toBeUndefined()
  })

  it('density combat (battaglia): mostra il badge quando drafted.corrotto=true', () => {
    render(<WizardCard drafted={{ ...drafted(), corrotto: true }} density="combat" currentHp={100} />)
    const badge = screen.getByTestId('corrotto-badge')
    expect(badge).toHaveTextContent(/corrotto/i)
    expect(badge).toHaveTextContent(/non curabile/i)
  })

  it('density combat: nessun badge quando non corrotto', () => {
    render(<WizardCard drafted={drafted()} density="combat" currentHp={100} />)
    expect(screen.queryByTestId('corrotto-badge')).toBeNull()
  })
})
