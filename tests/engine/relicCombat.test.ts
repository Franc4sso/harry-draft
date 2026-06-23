import { describe, it, expect } from 'vitest'
import { simulateBattle, toBattleUnits } from '@/game/engine/combat/simulate'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARDS } from '@/data/wizards'
import { RELIC_BY_ID } from '@/data/relics'
import type { ActiveRelic } from '@/types'

function team(seed: number, n = 5) {
  const r = createRng(seed)
  return WIZARDS.slice(0, n).map(w => draftWizard(r, w))
}
const ar = (id: string): ActiveRelic => ({ relic: RELIC_BY_ID[id]!, stageObtained: 0 })

describe('relics in combat', () => {
  it('toBattleUnits applies a flat relic bonus on top of synergies', () => {
    const t = team(1)
    const noRelic = toBattleUnits(t, 'left', [])
    const withRelic = toBattleUnits(t, 'left', [], [ar('mappa-malandrino')]) // +10 atk
    expect(withRelic[0]!.buffedStats.atk).toBe(noRelic[0]!.buffedStats.atk + 10)
  })

  it('startOfBattle relic grants the left team a shield at battle start', () => {
    const res = simulateBattle(team(1), team(2), createRng(3), { leftRelics: [ar('pietra-resurrezione')] })
    // The shield effect logs a turn-0 system entry flagged 'block' for each left unit.
    const shieldLog = res.log.filter(e => e.turn === 0 && e.type === 'system' && e.flags.includes('block'))
    expect(shieldLog.length).toBe(5) // one per left unit
    expect(shieldLog.every(e => e.actorSide === 'left')).toBe(true)
    // the battle still resolves to a winner
    expect(['left', 'right']).toContain(res.winner)
  })

  it('startOfBattle absent => no turn-0 shield log', () => {
    const res = simulateBattle(team(1), team(2), createRng(3))
    expect(res.log.some(e => e.turn === 0)).toBe(false)
  })

  it('is deterministic with relics (startOfBattle + onHit)', () => {
    const a = simulateBattle(team(1), team(2), createRng(9), { leftRelics: [ar('boccino-doro'), ar('pietra-resurrezione')] })
    const b = simulateBattle(team(1), team(2), createRng(9), { leftRelics: [ar('boccino-doro'), ar('pietra-resurrezione')] })
    expect(a.winner).toBe(b.winner)
    expect(a.turns).toBe(b.turns)
    expect(a.log.length).toBe(b.log.length)
    expect(JSON.stringify(a.log)).toBe(JSON.stringify(b.log))
  })

  it('onHit relic (boccino-doro) produces dot flags vs a no-relic run', () => {
    const withRelic = simulateBattle(team(1), team(2), createRng(9), { leftRelics: [ar('boccino-doro')] })
    const without = simulateBattle(team(1), team(2), createRng(9))
    const dotWith = withRelic.log.filter(e => e.flags.includes('dot')).length
    const dotWithout = without.log.filter(e => e.flags.includes('dot')).length
    expect(dotWith).toBeGreaterThan(dotWithout)
  })
})
