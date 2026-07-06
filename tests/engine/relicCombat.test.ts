import { describe, it, expect } from 'vitest'
import { simulateBattle, toBattleUnits } from '@/game/engine/combat/simulate'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARDS, WIZARD_BY_ID } from '@/data/wizards'
import { RELIC_BY_ID } from '@/data/relics'
import type { ActiveRelic } from '@/types'

function team(seed: number, n = 5) {
  const r = createRng(seed)
  return WIZARDS.slice(0, n).map(w => draftWizard(r, w))
}

/** A team whose wizards carry NO base dot-producing trait (no `veleno`). They can
 *  still pick up dots from a shiny draft roll or from anti-stall fatigue, so callers
 *  isolate a relic's contribution by the relic dot's own 'Veleno' action label rather
 *  than relying on a globally dot-free baseline. */
function dotFreeTeam(seed: number) {
  const r = createRng(seed)
  // dumbledore=pietrificazione, mcgonagall=roccia, harry=esecuzione/furia,
  // ron=roccia, hagrid=roccia — none apply a dot.
  return ['dumbledore', 'mcgonagall', 'harry', 'ron', 'hagrid']
    .map(id => draftWizard(r, WIZARD_BY_ID[id]!))
}
const ar = (id: string): ActiveRelic => ({ relic: RELIC_BY_ID[id]!, stageObtained: 0 })

describe('relics in combat', () => {
  it('toBattleUnits applies a flat relic bonus on top of synergies', () => {
    const t = team(1)
    const noRelic = toBattleUnits(t, 'left', [])
    const withRelic = toBattleUnits(t, 'left', [], [ar('mappa-malandrino')]) // +6 atk (Task 10 redesign)
    expect(withRelic[0]!.buffedStats.atk).toBe(noRelic[0]!.buffedStats.atk + 6)
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
    // boccino-doro applies an INLINE dot on hit (a statusId-less `{ kind: 'dot' }`
    // effect). Inline dots tick under the fallback action label 'Veleno', whereas
    // named-status dots tick under their status name (e.g. the `burn` status ticks as
    // 'Bruciatura') and anti-stall fatigue ticks as 'Fatica'. Both of those ALSO carry
    // the 'dot' flag, and on these teams they can fire unrelated to the relic: a shiny
    // draft roll may grant a `veleno` (burn) trait, and a long fight reaches fatigue.
    // So we isolate the RELIC's contribution by counting 'Veleno' ticks specifically —
    // the only inline-dot source here — which keeps the assertion robust to that noise.
    const left = dotFreeTeam(1)
    const right = dotFreeTeam(2)
    const relicDots = (res: ReturnType<typeof simulateBattle>) =>
      res.log.filter(e => e.flags.includes('dot') && e.action === 'Veleno').length
    const withRelic = simulateBattle(left, right, createRng(6), { leftRelics: [ar('boccino-doro')] })
    const without = simulateBattle(left, right, createRng(6))
    const dotWith = relicDots(withRelic)
    const dotWithout = relicDots(without)
    expect(dotWithout).toBe(0)
    expect(dotWith).toBeGreaterThan(dotWithout)
  })
})
