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

    // Baseline: no right relics.
    const base = simulateBattle(left, right, createRng('b'), {})

    // Same battle, but the ENEMY gets a strong flat-stat relic.
    const enemyRelic: ActiveRelic[] = [{ relic: RELIC_BY_ID['mappa-malandrino']!, stageObtained: 0 }]
    const withEnemyRelic = simulateBattle(left, right, createRng('b'), { rightRelics: enemyRelic })

    // The enemy got stronger → the outcome (winner or turn count or final HP) must differ.
    const baseRightHp = base.finalSnapshot.filter(u => u.side === 'right').reduce((s, u) => s + u.hp, 0)
    const buffRightHp = withEnemyRelic.finalSnapshot.filter(u => u.side === 'right').reduce((s, u) => s + u.hp, 0)
    expect(buffRightHp === baseRightHp && base.winner === withEnemyRelic.winner && base.turns === withEnemyRelic.turns).toBe(false)
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
