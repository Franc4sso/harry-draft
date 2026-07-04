import { describe, it, expect } from 'vitest'
import { buildBattlePackage } from '@/game/engine/combat/battlePackage'
import { generateBossTeam } from '@/game/engine/combat/teamGen'
import { createRng } from '@/game/engine/rng'
import { spellIsOffensive } from '@/game/engine/statRoll'
import { MURO_ALT } from '@/data/bosses'
import { WIZARD_BY_ID } from '@/data/wizards'

// Regression guard for the "degenerate enemy" bug: an ELITE or BOSS enemy wizard whose
// equipped active spell never deals damage is a free win for the player. `preferOffense`
// alone is only a soft bias with a silent no-op fallback — this suite proves the STRICT
// guarantee (guaranteeOffensiveSpell, wired via draftWizard's `guaranteeOffense` param)
// closes that hole for every enemy wizard in elite/boss battles, across many seeds.
describe('attack move guarantee — enemy elite/boss', () => {
  it('every ENEMY wizard in ELITE battles has an offensive active spell (many seeds/areas)', () => {
    const offenders: string[] = []
    for (let area = 0; area < 3; area++) {
      for (let floor = 0; floor < 5; floor++) {
        for (let s = 0; s < 30; s++) {
          const { battle } = buildBattlePackage(`elite-${area}-${floor}-${s}`, area, floor, 'elite')
          for (const dw of battle.enemyTeam) {
            if (!spellIsOffensive(dw.spell)) {
              offenders.push(`area${area} floor${floor} seed${s} ${dw.wizard.id}→${dw.spell.id}`)
            }
          }
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('every ENEMY wizard in BOSS battles has an offensive active spell (many seeds/areas)', () => {
    const offenders: string[] = []
    for (let area = 0; area < 3; area++) {
      for (let floor = 0; floor < 5; floor++) {
        for (let s = 0; s < 30; s++) {
          const { battle } = buildBattlePackage(`boss-${area}-${floor}-${s}`, area, floor, 'boss')
          for (const dw of battle.enemyTeam) {
            if (!spellIsOffensive(dw.spell)) {
              offenders.push(`area${area} floor${floor} seed${s} ${dw.wizard.id}→${dw.spell.id}`)
            }
          }
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('the MURO_ALT (pettigrew) leader — a pure-support wizard with NO attack spell in its pool — ends up with an offensive active', () => {
    // Sanity precondition: pettigrew's own spell pool has zero offensive spells, so any
    // pass here is because of the base_attack fallback, not a lucky pool draw.
    const pettigrew = WIZARD_BY_ID['pettigrew']!
    expect(pettigrew.spellPool.some(id => id === 'base_attack')).toBe(false)

    for (let s = 0; s < 25; s++) {
      const team = generateBossTeam(createRng(`muro-alt-${s}`), MURO_ALT)
      const leader = team.find(d => d.wizard.id === 'pettigrew')
      expect(leader, `seed ${s}: pettigrew not fielded as leader`).toBeTruthy()
      expect(spellIsOffensive(leader!.spell), `seed ${s} → ${leader!.spell.id}`).toBe(true)
    }
  })

  it('the MURO_ALT (pettigrew) boss is reachable via the real seeded pick and still guarantees offense', () => {
    // Hunt across seeds for one that actually routes the area-0 boss pick to MURO_ALT
    // (BOSSES_BY_AREA[0] = [MURO, MURO_ALT]) via buildBattlePackage's own bossPick fork,
    // so this exercises the full production path, not just generateBossTeam directly.
    let found = false
    for (let s = 0; s < 200 && !found; s++) {
      const { battle, preview } = buildBattlePackage(`hunt-${s}`, 0, 0, 'boss')
      if (preview.bossName === 'Peter Minus') {
        found = true
        const leader = battle.enemyTeam.find(d => d.wizard.id === 'pettigrew')
        expect(leader, `seed hunt-${s}: pettigrew not on the fielded team`).toBeTruthy()
        expect(spellIsOffensive(leader!.spell), `seed hunt-${s} → ${leader!.spell.id}`).toBe(true)
      }
    }
    expect(found, 'no seed in [0,200) routed the area-0 boss pick to MURO_ALT/pettigrew').toBe(true)
  })
})
