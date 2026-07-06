import { describe, it, expect } from 'vitest'
import { simulateBattle } from '@/game/engine/combat/simulate'
import { buildReplay, unitKey } from '@/game/engine/combat/replay'
import { createRng } from '@/game/engine/rng'
import { WIZARDS } from '@/data/wizards'
import { SPELL_BY_ID } from '@/data/spells'
import type { DraftedWizard, Stats } from '@/types'

function mk(id: string, stats: Stats, spellId = 'base_attack'): DraftedWizard {
  const wizard = WIZARDS.find(w => w.id === id)!
  return { wizard, stats, maxHp: stats.hp, spell: SPELL_BY_ID[spellId]! }
}

// Repro for the "dead wizard still acts / poison mage revives itself" bug.
// A unit that carries BOTH veleno (permanent DoT) AND a regen tick (e.g. a Rigenera synergy
// heal) would, in a single end-of-round tickStatuses pass, take lethal veleno damage (hp -> 0)
// and then be healed back above 0 by its own regen in the SAME tick — because unit.alive was
// only synced AFTER the whole tick, so the heal read a stale "alive" and the death never landed.
// Result: the mage keeps fighting (attacking, poisoning) after it should have died.
describe('a unit killed by a DoT tick stays dead (no self-revive via same-tick regen)', () => {
  it('once hp reaches 0 it never climbs back above 0 in the replay', () => {
    for (const seed of ['dead-1', 'dead-2', 'dead-3', 'dead-4', 'dead-5']) {
      // harry carries veleno (from the enemy) AND a Rigenera team-heal (Tassorosso synergy):
      // its own regen tick is what illegitimately revived it. Use the same fragile setup that
      // surfaced the bug: low-HP harry, two poisoners, plus a self-regen source.
      const left = [mk('harry', { hp: 40, atk: 20, def: 5, spd: 25 }, 'serpensortia')]
      const right = [
        mk('greyback', { hp: 300, atk: 8, def: 5, spd: 30 }, 'serpensortia'),
        mk('lucius', { hp: 300, atk: 8, def: 5, spd: 5 }, 'serpensortia'),
      ]
      // Tassorosso Rigenera synergy on the left team gives harry an end-of-round regen tick.
      const rigenera = {
        synergy: { id: 'rigenera', name: 'Rigenera', kind: 'house' as const, requires: {}, bonus: { regen: 6 } },
        memberIds: ['harry'],
      }
      const result = simulateBattle(left, right, createRng(seed), { leftSyn: [rigenera] as never })
      const replay = buildReplay(result, left, right, { leftSyn: [rigenera] as never })
      const hk = unitKey('left', 'harry')

      let died = false
      for (const f of replay.frames) {
        const hp = f.hp[hk]
        if (hp === undefined) continue
        if (hp <= 0) died = true
        if (died) {
          expect(hp, `seed ${seed}: harry revived to ${hp} after already dying (frame ${f.index}, ${f.entry?.action})`).toBe(0)
        }
      }
    }
  })
})
