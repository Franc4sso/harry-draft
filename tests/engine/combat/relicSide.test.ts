import { describe, it, expect } from 'vitest'
import { simulateBattle } from '@/game/engine/combat/simulate'
import { createRng } from '@/game/engine/rng'
import { draftWizard } from '@/game/engine/statRoll'
import { WIZARD_BY_ID } from '@/data/wizards'
import { RELIC_BY_ID } from '@/data/relics'
import type { ActiveRelic, DraftedWizard } from '@/types'

function team(ids: string[]): DraftedWizard[] {
  return ids.map((id, i) => draftWizard(createRng(`t-${id}-${i}`), WIZARD_BY_ID[id]!))
}

describe('bilateral relics', () => {
  it('a right-side relic changes the battle outcome vs baseline with no right relics', () => {
    const left = team(['harry', 'sirius', 'lupin', 'mcgonagall', 'snape'])
    const right = team(['voldemort', 'bellatrix', 'lucius', 'snape', 'sirius'])
    const enemyRelic: ActiveRelic[] = [{ relic: RELIC_BY_ID['mappa-malandrino']!, stageObtained: 0 }]

    // UN MAGO, UNA MAGIA (Task 2) made every wizard's spell choice deterministic (no more
    // pool-of-many rng.pick variance), which made this exact fixed roster a near-total left
    // curbstomp (right-side HP already at 0 pre-relic) for most battle seeds — a flat +6 atk
    // enemy relic literally cannot change an already-0 finalSnapshot HP / turn / winner. So
    // search seeds for one where the fight is close enough for the relic to matter, instead
    // of relying on a single hardcoded seed.
    let differs = false
    for (let i = 0; i < 40 && !differs; i++) {
      const seed = `rs-${i}`
      const base = simulateBattle(left, right, createRng(seed), {})
      const withEnemyRelic = simulateBattle(left, right, createRng(seed), { rightRelics: enemyRelic })
      const baseRightHp = base.finalSnapshot.filter(u => u.side === 'right').reduce((s, u) => s + u.hp, 0)
      const buffRightHp = withEnemyRelic.finalSnapshot.filter(u => u.side === 'right').reduce((s, u) => s + u.hp, 0)
      differs = !(buffRightHp === baseRightHp && base.winner === withEnemyRelic.winner && base.turns === withEnemyRelic.turns)
    }
    expect(differs).toBe(true)
  })

  it('parity: identical result when rightRelics is absent vs empty', () => {
    const left = team(['harry', 'sirius', 'lupin', 'mcgonagall', 'snape'])
    const right = team(['voldemort', 'bellatrix', 'lucius', 'snape', 'sirius'])
    const a = simulateBattle(left, right, createRng('p'), { leftRelics: [] })
    const b = simulateBattle(left, right, createRng('p'), { leftRelics: [], rightRelics: [] })
    expect(a.winner).toBe(b.winner)
    expect(a.turns).toBe(b.turns)
    expect(a.log.length).toBe(b.log.length)
  })
})
