import { describe, it, expect } from 'vitest'
import { simulateBattle } from '@/game/engine/combat/simulate'
import { createRng } from '@/game/engine/rng'
import { RELICS } from '@/data/relics'
import { WIZARDS } from '@/data/wizards'
import { SPELL_BY_ID } from '@/data/spells'
import type { ActiveRelic, ActiveSynergy, BattleResult, DraftedWizard, Stats } from '@/types'

// Esecuzione grant: +40% damage to targets under 30% HP (the Spada relic).
const spada = RELICS.find(r => r.id === 'spada-grifondoro')!
const sigillo = RELICS.find(r => r.id === 'sigillo-carnefice')!

function mk(id: string, stats: Stats): DraftedWizard {
  const wizard = WIZARDS.find(w => w.id === id)!
  return { wizard, stats, maxHp: stats.hp, spell: SPELL_BY_ID['base_attack']! }
}
// Synthetic high-regen synergy for the durable-wall counter (kept off the roster so it's controlled).
function regenSyn(amount: number): ActiveSynergy {
  return { synergy: { id: 'test-regen', name: 'Test Regen', kind: 'group', requires: { count: 1 }, bonus: { regen: amount } }, memberIds: [] }
}
const exec: ActiveRelic[] = [{ relic: spada, stageObtained: 0 }, { relic: sigillo, stageObtained: 0 }]

describe('Esecuzione counter-web', () => {
  // A modest-attack finisher: needs the execute bonus to push targets over the kill line.
  const execTeam = [mk('harry', { hp: 360, atk: 18, def: 18, spd: 30 })]

  it('BEATS a Fragile/glass-cannon enemy (finisher closes out a target the execute pushes under)', () => {
    // A glass cannon: hits hard but thin (low HP). Without execute the finisher trades down and
    // dies first; the +40% execute bonus, applied once the enemy dips under 30% HP, lands the kill
    // one turn sooner — that single turn is the whole margin.
    const fragile = [mk('bellatrix', { hp: 180, atk: 34, def: 14, spd: 35 })]
    const plain = simulateBattle(execTeam, fragile, createRng('b'))
    const withExec = simulateBattle(execTeam, fragile, createRng('b'), { leftRelics: exec })
    expect(plain.winner).toBe('right')      // baseline: the glass cannon trades down and wins
    expect(withExec.winner).toBe('left')    // execute flips it — the finisher closes the gap
  })

  it('LOSES to a durable wall that never drops under the threshold (Regen sustain)', () => {
    // A high-HP regen wall: it sits comfortably above 30% HP, so the execute bonus never
    // triggers and the finisher has no edge — the wall out-sustains the chip damage.
    const wall = [mk('greyback', { hp: 1200, atk: 24, def: 60, spd: 12 })]
    const r: BattleResult = simulateBattle(execTeam, wall, createRng('exec-ctr-wall'), { leftRelics: exec, rightSyn: [regenSyn(120)] })
    expect(r.winner).toBe('right')
  })

  it('LOSES to a durable wall even WITH execute (no improvement vs a target above threshold)', () => {
    // Control: against a wall that stays above threshold, execute changes nothing.
    const wall = [mk('greyback', { hp: 1200, atk: 24, def: 60, spd: 12 })]
    const plain = simulateBattle(execTeam, wall, createRng('exec-ctr-wall2'), { rightSyn: [regenSyn(120)] })
    const withExec = simulateBattle(execTeam, wall, createRng('exec-ctr-wall2'), { leftRelics: exec, rightSyn: [regenSyn(120)] })
    expect(plain.winner).toBe('right')
    expect(withExec.winner).toBe('right')
  })
})
