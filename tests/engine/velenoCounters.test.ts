import { describe, it, expect } from 'vitest'
import { simulateBattle } from '@/game/engine/combat/simulate'
import { createRng } from '@/game/engine/rng'
import { RELICS } from '@/data/relics'
import { WIZARDS } from '@/data/wizards'
import { SPELL_BY_ID } from '@/data/spells'
import type { ActiveRelic, BattleResult, DraftedWizard, Stats } from '@/types'

const pugnale = RELICS.find(r => r.id === 'pugnale-bellatrix')!   // 100% onHit → veleno

function mk(id: string, stats: Stats): DraftedWizard {
  const wizard = WIZARDS.find(w => w.id === id)!
  return { wizard, stats, maxHp: stats.hp, spell: SPELL_BY_ID['base_attack']! }
}
// Synthetic high-regen relic for the Regen counter (kept off the roster so it's controlled).
// NOTE: regen-via-ActiveSynergy (`bonus.regen`) was removed from the engine (2026-07-21, along
// with the 8 team synergies and totalRegen) — regen now flows only through relics
// (totalRelicRegen, game/engine/relics.ts), so this fixture is a synthetic ActiveRelic instead
// of the ActiveSynergy it used to be. Same controlled-magnitude intent, real channel.
function regenRelic(amount: number): ActiveRelic {
  return { relic: { id: 'test-regen', name: 'Test Regen', desc: '', rarity: 'comune', bonus: { regen: amount } }, stageObtained: 0 }
}
const pug: ActiveRelic[] = [{ relic: pugnale, stageObtained: 0 }]

describe('Veleno counter-web', () => {
  // A weak-attack poison applier: atk 1 → base hits floor at minDamage(1), negligible; equal speed removes chip-win cheese.
  const velenoTeam = [mk('bellatrix', { hp: 400, atk: 1, def: 50, spd: 20 })]

  it('BEATS a Tank/Scudi enemy (poison bypasses huge DEF)', () => {
    const tank = [mk('greyback', { hp: 1000, atk: 1, def: 500, spd: 20 })]
    const r: BattleResult = simulateBattle(velenoTeam, tank, createRng('ctr-tank'), { leftRelics: pug })
    expect(r.winner).toBe('left')
  })

  it('LOSES to a Regen enemy (sustain out-heals the poison)', () => {
    const tank = [mk('greyback', { hp: 1000, atk: 1, def: 500, spd: 20 })]
    const win = simulateBattle(velenoTeam, tank, createRng('ctr-regen'), { leftRelics: pug })
    const withRegen = simulateBattle(velenoTeam, tank, createRng('ctr-regen'), { leftRelics: pug, rightRelics: [regenRelic(150)] })
    expect(win.winner).toBe('left')          // baseline: poison wins
    expect(withRegen.winner).toBe('right')   // regen flips it
  })

  it('LOSES to Burst (applier killed before the ramp)', () => {
    const squishy = [mk('bellatrix', { hp: 30, atk: 8, def: 5, spd: 5 })]
    const burst = [mk('harry', { hp: 200, atk: 400, def: 20, spd: 99 })]
    const r = simulateBattle(squishy, burst, createRng('ctr-burst'), { leftRelics: pug })
    expect(r.winner).toBe('right')
  })
})
