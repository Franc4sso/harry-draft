import { describe, it, expect } from 'vitest'
import { simulateBattle } from '@/game/engine/combat/simulate'
import { createRng } from '@/game/engine/rng'
import { RELICS } from '@/data/relics'
import { WIZARDS } from '@/data/wizards'
import { SPELL_BY_ID } from '@/data/spells'
import type { ActiveRelic, DraftedWizard, Stats } from '@/types'

// Mira Infallibile grant: the team never misses (alwaysHit skips the canDodge gate entirely).
const occhio = RELICS.find(r => r.id === 'occhio-magico')!

function mk(id: string, stats: Stats): DraftedWizard {
  const wizard = WIZARDS.find(w => w.id === id)!
  return { wizard, stats, maxHp: stats.hp, spell: SPELL_BY_ID['base_attack']! }
}

const mira: ActiveRelic[] = [{ relic: occhio, stageObtained: 0 }]

describe('Mira Infallibile counter-web', () => {
  // Left attacker: very slow (spd=10). Right evader: very fast (spd=200).
  // Speed gap for left's attacks = 200 - 10 = 190.
  // dodgeChance = dodgeBase(0.02) + 190 * dodgeScale(0.0012) ≈ 25%.
  // Over ~18 pre-fatigue attacks this virtually guarantees dodges in the CONTROL arm.
  // Right ATK is negligible (min-damage 1/hit) so left wins in both arms —
  // the ONLY variable between BEATS and CONTROL is the occhio-magico relic.
  const attacker = [mk('harry', { hp: 600, atk: 30, def: 25, spd: 10 })]
  const evader   = [mk('ron',   { hp: 500, atk:  5, def: 15, spd: 200 })]

  it('BEATS dodge-stacking — alwaysHit suppresses all dodge rolls (zero dodge flags)', () => {
    // With occhio-magico: alwaysHit=true → the "eff.canDodge && !ctx.actor.alwaysHit" gate
    // short-circuits before dodged() is ever called. Every attack lands regardless of speed gap.
    const r = simulateBattle(attacker, evader, createRng('infallibile-beats'), { leftRelics: mira })
    const dodges = r.log.filter(e => e.actorSide === 'left' && e.flags.includes('dodge')).length
    expect(dodges).toBe(0)
    expect(r.winner).toBe('left')
  })

  it('CONTROL — same stats/seed but no alwaysHit yields > 0 dodge flags (relic is the lever)', () => {
    // Without the relic: alwaysHit=false → dodged() fires on every canDodge attack.
    // gap=190 gives ≈25% dodge chance; right's attacks on left have 0% (gap is negative).
    // All dodge flags in the log belong to left's attacks — filtering by actorSide='left'
    // captures them cleanly and proves the mechanic, not a confound.
    const r = simulateBattle(attacker, evader, createRng('infallibile-beats'))
    const dodges = r.log.filter(e => e.actorSide === 'left' && e.flags.includes('dodge')).length
    expect(dodges).toBeGreaterThan(0)
  })
})
