import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WizardCardColumn } from '@/components/cards/WizardCardColumn'
import { WizardCardRow } from '@/components/cards/WizardCardRow'
import { UnitBust } from '@/components/battle/UnitBust'
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

describe('Corrotto badge', () => {
  it('WizardCardColumn: mostra il badge quando corrotto=true, con testo "non curabile"', () => {
    render(<WizardCardColumn drafted={{ ...drafted(), corrotto: true }} />)
    const badge = screen.getByTestId('corrotto-badge')
    expect(badge).toHaveTextContent(/corrotto/i)
    expect(badge).toHaveTextContent(/non curabile/i)
  })

  it('WizardCardColumn: nessun badge quando non corrotto', () => {
    render(<WizardCardColumn drafted={drafted()} />)
    expect(screen.queryByTestId('corrotto-badge')).toBeNull()
  })

  it('WizardCardRow (roster/battaglia): mostra il badge quando corrotto=true', () => {
    render(<WizardCardRow drafted={{ ...drafted(), corrotto: true }} />)
    const badge = screen.getByTestId('corrotto-badge')
    expect(badge).toHaveTextContent(/corrotto/i)
    expect(badge).toHaveTextContent(/non curabile/i)
  })

  it('WizardCardRow: nessun badge quando non corrotto', () => {
    render(<WizardCardRow drafted={drafted()} />)
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

  it('UnitBust (battaglia): mostra il badge quando unit.corrotto=true', () => {
    const l = team(['harry'], 1)
    const r = team(['draco'], 2)
    l[0] = { ...l[0]!, corrotto: true }
    const replay = buildReplay(emptyResult, l, r)
    const unit = replay.units.find(u => u.key === unitKey('left', 'harry'))!

    render(<UnitBust unit={unit} hp={unit.maxHp} />)
    const badge = screen.getByTestId('corrotto-badge')
    expect(badge).toHaveTextContent(/corrotto/i)
    expect(badge).toHaveTextContent(/non curabile/i)
  })

  it('UnitBust (battaglia): nessun badge quando non corrotto', () => {
    const l = team(['harry'], 1)
    const r = team(['draco'], 2)
    const replay = buildReplay(emptyResult, l, r)
    const unit = replay.units.find(u => u.key === unitKey('left', 'harry'))!

    render(<UnitBust unit={unit} hp={unit.maxHp} />)
    expect(screen.queryByTestId('corrotto-badge')).toBeNull()
  })
})
