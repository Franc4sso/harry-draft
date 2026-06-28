import { describe, it, expect } from 'vitest'
import { simulateBattle } from '@/game/engine/combat/simulate'
import { createRng } from '@/game/engine/rng'
import { RELICS } from '@/data/relics'
import { WIZARDS } from '@/data/wizards'
import { SPELL_BY_ID } from '@/data/spells'
import type { ActiveRelic, ActiveSynergy, BattleResult, DraftedWizard, Stats } from '@/types'

const pugnale = RELICS.find(r => r.id === 'pugnale-bellatrix')!   // 100% onHit → veleno

function mk(id: string, stats: Stats): DraftedWizard {
  const wizard = WIZARDS.find(w => w.id === id)!
  return { wizard, stats, maxHp: stats.hp, spell: SPELL_BY_ID['base_attack']! }
}
// Synthetic high-regen synergy for the Regen counter (kept off the roster so it's controlled).
function regenSyn(amount: number): ActiveSynergy {
  return { synergy: { id: 'test-regen', name: 'Test Regen', kind: 'group', requires: { count: 1 }, bonus: { regen: amount } }, memberIds: [] }
}
const pug: ActiveRelic[] = [{ relic: pugnale, stageObtained: 0 }]

describe('Veleno counter-web', () => {
  // A weak-attack poison applier: physical barely scratches, poison does the work.
  const velenoTeam = [mk('bellatrix', { hp: 200, atk: 8, def: 15, spd: 30 })]

  it('BEATS a Tank/Scudi enemy (poison bypasses huge DEF)', () => {
    const tank = [mk('greyback', { hp: 260, atk: 5, def: 500, spd: 1 })]
    const r: BattleResult = simulateBattle(velenoTeam, tank, createRng('ctr-tank'), { leftRelics: pug })
    expect(r.winner).toBe('left')
  })

  it('LOSES to a Regen enemy (sustain out-heals the poison)', () => {
    const tank = [mk('greyback', { hp: 260, atk: 5, def: 500, spd: 1 })]
    const win = simulateBattle(velenoTeam, tank, createRng('ctr-regen'), { leftRelics: pug })
    const withRegen = simulateBattle(velenoTeam, tank, createRng('ctr-regen'), { leftRelics: pug, rightSyn: [regenSyn(60)] })
    expect(win.winner).toBe('left')          // baseline: poison wins
    expect(withRegen.winner).not.toBe('left') // regen flips it
  })

  it('LOSES to Burst (applier killed before the ramp)', () => {
    const squishy = [mk('bellatrix', { hp: 30, atk: 8, def: 5, spd: 5 })]
    const burst = [mk('harry', { hp: 200, atk: 400, def: 20, spd: 99 })]
    const r = simulateBattle(squishy, burst, createRng('ctr-burst'), { leftRelics: pug })
    expect(r.winner).toBe('right')
  })
})
