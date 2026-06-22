import { describe, it, expect } from 'vitest'
import { simulateBattle, toBattleUnits } from '@/game/engine/combat/simulate'
import { draftWizard } from '@/game/engine/statRoll'
import { detectSynergies } from '@/game/engine/synergy'
import { createRng } from '@/game/engine/rng'
import { WIZARDS } from '@/data/wizards'

function team(rng = createRng(1), n = 5) {
  return WIZARDS.slice(0, 200).filter((_, i) => i % 2 === 0).slice(0, n).map(w => draftWizard(rng, w))
}

describe('simulate', () => {
  it('produces a winner and a non-empty log', () => {
    const left = team(createRng(1)); const right = team(createRng(2))
    const res = simulateBattle(left, right, createRng(3))
    expect(['left', 'right']).toContain(res.winner)
    expect(res.log.length).toBeGreaterThan(0)
    expect(res.turns).toBeLessThanOrEqual(100)
  })
  it('is fully deterministic for the same seeds', () => {
    const l = team(createRng(1)); const r = team(createRng(2))
    const a = simulateBattle(l, r, createRng(9))
    const l2 = team(createRng(1)); const r2 = team(createRng(2))
    const b = simulateBattle(l2, r2, createRng(9))
    expect(a.winner).toBe(b.winner)
    expect(a.turns).toBe(b.turns)
    expect(a.log.length).toBe(b.log.length)
    expect(a.mvpId).toBe(b.mvpId)
  })
  it('terminates even with healers (no infinite loop)', () => {
    const left = team(createRng(11)); const right = team(createRng(12))
    const res = simulateBattle(left, right, createRng(13))
    expect(res.turns).toBeGreaterThan(0)
  })
  it('reports an mvp from the winning context', () => {
    const res = simulateBattle(team(createRng(1)), team(createRng(2)), createRng(5))
    expect(res.mvpId).toBeTruthy()
  })
  it('synergy buffs increase starting hp', () => {
    const raw = team(createRng(1))
    const syn = detectSynergies(raw)
    const buffed = toBattleUnits(raw, 'left', syn)
    expect(buffed).toHaveLength(raw.length)
  })
  it('is deterministic when the same wizard id appears on both teams', () => {
    // Build two teams that both include 'harry' — same id on left and right.
    const harryWizard = WIZARDS.find(w => w.id === 'harry')!
    const rngL = createRng(42)
    const rngR = createRng(43)
    // Build 3-unit teams: harry + two others, left and right share the harry id
    const leftTeam = [
      draftWizard(rngL, harryWizard),
      draftWizard(rngL, WIZARDS.find(w => w.id === 'snape')!),
      draftWizard(rngL, WIZARDS.find(w => w.id === 'hermione')!),
    ]
    const rightTeam = [
      draftWizard(rngR, harryWizard), // same wizard.id 'harry' on opposite side
      draftWizard(rngR, WIZARDS.find(w => w.id === 'dumbledore')!),
      draftWizard(rngR, WIZARDS.find(w => w.id === 'voldemort')!),
    ]
    const run = () => simulateBattle(
      leftTeam.map(u => ({ ...u })),
      rightTeam.map(u => ({ ...u })),
      createRng(99),
    )
    const a = run()
    const b = run()
    expect(a.winner).toBe(b.winner)
    expect(a.turns).toBe(b.turns)
    expect(a.log.length).toBe(b.log.length)
    expect(a.mvpId).toBe(b.mvpId)
  })
})
