import { describe, it, expect } from 'vitest'
import { simulateBattle } from '@/game/engine/combat/simulate'
import { createRng } from '@/game/engine/rng'
import { RELICS } from '@/data/relics'
import { WIZARDS } from '@/data/wizards'
import { SPELL_BY_ID } from '@/data/spells'
import type { ActiveRelic, DraftedWizard, Stats } from '@/types'

const marchioRelic = RELICS.find(r => r.id === 'marchio-nero')!

const mk = (id: string, stats: Stats, spellId = 'base_attack'): DraftedWizard => ({
  wizard: WIZARDS.find(w => w.id === id)!,
  stats,
  maxHp: stats.hp,
  spell: SPELL_BY_ID[spellId]!,
})

const marchioOn = (carrier: string): ActiveRelic[] => [{ relic: marchioRelic, stageObtained: 0, assignedTo: carrier }]

describe('Magie Oscure counter-web', () => {
  // Tuned (2026-06-29):
  // BEATS-squishy: seed=dark5, nukerAtk=28, squishyHp=370, squishyDef=25
  //   — avada (power 3.2, hitChance 0.6) on that seed lands; +50% marchio bonus pushes dmg past 370hp threshold.
  // LOSES-to-shield: seed=mo-shield, wallHp=900, wallDef=80
  //   — wall out-bulks the nuker; right wins.
  // LOSES-to-chip: seed=mo-chip, carrierHp=60, chipperAtk=35
  //   — carrier is low-HP; recoil on landed avada fires AND right wins.

  // The nuker casts avada (dark, power 3.2, hitChance 0.6).
  // Without Marchio he doesn't close the squishy; with +50% amplify he one-shots.
  const nuker = () => [mk('voldemort', { hp: 400, atk: 28, def: 20, spd: 40 }, 'avada')]

  it('BEATS a squishy (amplified nuke closes a target a plain cast leaves alive)', () => {
    const squishy = [mk('draco', { hp: 370, atk: 28, def: 25, spd: 35 }, 'avada')]
    const plain = simulateBattle(nuker(), squishy, createRng('dark5'))
    const withMarchio = simulateBattle(nuker(), squishy, createRng('dark5'), { leftRelics: marchioOn('voldemort') })
    expect(plain.winner).toBe('right')        // baseline: nuke doesn't quite close
    expect(withMarchio.winner).toBe('left')   // amplify flips it
  })

  it('LOSES to a shielded wall (out-bulked → no payoff)', () => {
    // A very high-HP, high-def wall out-bulks the amplified nuker.
    const wall = [mk('greyback', { hp: 900, atk: 30, def: 80, spd: 14 })]
    const r = simulateBattle(nuker(), wall, createRng('mo-shield'), { leftRelics: marchioOn('voldemort') })
    expect(r.winner).not.toBe('left')
  })

  it('LOSES to chip/control (kept low, recoil on the full nuke kills the carrier)', () => {
    // A fast chipper keeps the carrier at very low HP (60).
    // Recoil on a landed avada (20% of ~190 residual dmg ≈ 38) exceeds remaining HP → self-KO.
    const carrier = [mk('voldemort', { hp: 60, atk: 28, def: 10, spd: 20 }, 'avada')]
    const chipper = [mk('harry', { hp: 500, atk: 35, def: 20, spd: 30 })]
    const r = simulateBattle(carrier, chipper, createRng('mo-chip'), { leftRelics: marchioOn('voldemort') })
    expect(r.winner).toBe('right')
    // The carrier's own recoil must appear in the log (risk signature of the archetype).
    expect(r.log.some(e => e.flags.includes('recoil'))).toBe(true)
  })
})
