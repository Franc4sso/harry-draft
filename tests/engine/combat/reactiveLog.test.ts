import { describe, it, expect } from 'vitest'
import { simulateBattle } from '@/game/engine/combat/simulate'
import { buildReplay, unitKey } from '@/game/engine/combat/replay'
import { createRng } from '@/game/engine/rng'
import type { ActiveRelic, DraftedWizard, Relic } from '@/types'

// A left unit that takes some damage so an onHeal effect has room to heal.
function unit(id: string, atk = 30, hp = 200, def = 10, spd = 10): DraftedWizard {
  return {
    wizard: { id, name: id, house: 'Grifondoro', role: 'Attaccante' } as any,
    stats: { hp, atk, def, spd }, maxHp: hp,
    spell: { id: 'jinx', name: 'Jinx', desc: '', type: 'Attacco', power: 1, hitChance: 1 },
  }
}

// A left healer: casts a Cura spell so an onHeal hook fires deterministically.
function healer(id: string): DraftedWizard {
  return {
    wizard: { id, name: id, house: 'Grifondoro', role: 'Guaritore' } as any,
    stats: { hp: 200, atk: 5, def: 10, spd: 5 }, maxHp: 200,
    spell: { id: 'cura', name: 'Cura', desc: '', type: 'Cura', power: 1, hitChance: 1 },
  }
}

describe('fireReactive replay-parity logging', () => {
  // A LEFT relic whose onHeal trigger applies a heal-with-value. fireReactive must
  // push a system log entry carrying that value so buildReplay reconstructs the same HP.
  const onHealRelic: Relic = {
    id: 'onheal-rel', name: 'onheal', desc: '', rarity: 'epica',
    triggers: [{ hook: 'onHeal', effects: [{ kind: 'heal', amount: 7 }] }],
  }

  it('logs a system entry with the effect value when onHeal fires', () => {
    const relics: ActiveRelic[] = [{ relic: onHealRelic, stageObtained: 0 }]
    // Damage a left unit (the attacker hits it via... no — left can only hit right).
    // Instead: a left healer heals the most-wounded ally; the heal flag triggers onHeal,
    // and our relic's onHeal effect heals +7. We need the healed unit below max so the
    // relic heal has a visible value and the original cura also resolves.
    const res = simulateBattle(
      [healer('hh'), unit('aa')],
      [unit('zz', 25)],
      createRng('reactive-seed').fork(2),
      { leftRelics: relics },
    )
    // A 'Reliquia' system entry carrying the onHeal effect value must exist.
    const relicHeals = res.log.filter(e =>
      e.action === 'Reliquia' && e.type === 'system' && typeof e.value === 'number' && e.value > 0,
    )
    expect(relicHeals.length).toBeGreaterThan(0)
  })

  it('buildReplay final HP matches live finalSnapshot HP (parity) when onHeal fires', () => {
    const relics: ActiveRelic[] = [{ relic: onHealRelic, stageObtained: 0 }]
    const res = simulateBattle(
      [healer('hh'), unit('aa')],
      [unit('zz', 25)],
      createRng('reactive-seed').fork(2),
      { leftRelics: relics },
    )
    const replay = buildReplay(res, [healer('hh'), unit('aa')], [unit('zz', 25)], { leftRelics: relics })
    const lastFrame = replay.frames[replay.frames.length - 1]!
    // Replay's final HP per unit must equal the live engine's finalSnapshot HP.
    for (const u of replay.units) {
      const snap = res.finalSnapshot.find(s => s.id === u.id)!
      // finalSnapshot is [...L, ...R]; match by side+id via the replay unit's side.
      expect(lastFrame.hp[u.key]).toBe(snap.hp)
    }
  })
})
