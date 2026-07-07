import { describe, it, expect } from 'vitest'
import { buildBattlePackage } from '@/game/engine/combat/battlePackage'
import { generateBossTeam } from '@/game/engine/combat/teamGen'
import { createRng } from '@/game/engine/rng'
import { spellIsOffensive, guaranteeOffensiveSpell } from '@/game/engine/statRoll'
import { MURO_ALT } from '@/data/bosses'
import { WIZARD_BY_ID } from '@/data/wizards'
import { SPELL_BY_ID } from '@/data/spells'

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

  it('the MURO_ALT (marcus) leader ends up with an offensive active spell', () => {
    // Leader was pettigrew (a Supporto) — replaced by marcus (Serpeverde Attaccante) because
    // no Supporto may be a boss-leader this slice (a Supporto is clamped to a Cura and can
    // never hold the offensive spell the "no harmless boss" invariant demands). marcus is a
    // real attacker, so the invariant holds natively here.
    for (let s = 0; s < 25; s++) {
      const team = generateBossTeam(createRng(`muro-alt-${s}`), MURO_ALT)
      const leader = team.find(d => d.wizard.id === 'marcus')
      expect(leader, `seed ${s}: marcus not fielded as leader`).toBeTruthy()
      expect(spellIsOffensive(leader!.spell), `seed ${s} → ${leader!.spell.id}`).toBe(true)
    }
  })

  it('the MURO_ALT (marcus) boss is reachable via the real seeded pick and still guarantees offense', () => {
    // Hunt across seeds for one that actually routes the area-0 boss pick to MURO_ALT
    // (BOSSES_BY_AREA[0] = [MURO, MURO_ALT]) via buildBattlePackage's own bossPick fork,
    // so this exercises the full production path, not just generateBossTeam directly.
    let found = false
    for (let s = 0; s < 200 && !found; s++) {
      const { battle, preview } = buildBattlePackage(`hunt-${s}`, 0, 0, 'boss')
      if (preview.bossName === 'Marcus Flint') {
        found = true
        const leader = battle.enemyTeam.find(d => d.wizard.id === 'marcus')
        expect(leader, `seed hunt-${s}: marcus not on the fielded team`).toBeTruthy()
        expect(spellIsOffensive(leader!.spell), `seed hunt-${s} → ${leader!.spell.id}`).toBe(true)
      }
    }
    expect(found, 'no seed in [0,200) routed the area-0 boss pick to MURO_ALT/marcus').toBe(true)
  })

  it('a Supporto forced through guaranteeOffensiveSpell gets a Cura, NEVER base_attack (the clamp)', () => {
    // The other half of the boss-leader ban: a Supporto (pettigrew) with an all-support pool,
    // if ever forced through the offense guarantee, must fall back to a Cura (episkey) — not
    // base_attack. This is why a Supporto can never be a non-harmless boss, and stays true to
    // its healer archetype. See game/engine/statRoll.ts guaranteeOffensiveSpell.
    const pettigrew = WIZARD_BY_ID['pettigrew']!
    // Precondition: pettigrew's pool is all support (no offensive spell) so the fallback fires.
    expect(pettigrew.spellPool.some(id => spellIsOffensive(SPELL_BY_ID[id]))).toBe(false)
    const supportSpell = SPELL_BY_ID[pettigrew.spellPool[0]!]!
    const guaranteed = guaranteeOffensiveSpell(pettigrew, supportSpell)
    expect(spellIsOffensive(guaranteed), `got ${guaranteed.id}`).toBe(false)
    expect(guaranteed.id).not.toBe('base_attack')
    expect(guaranteed.type === 'Cura' || guaranteed.type === 'Difesa').toBe(true)
  })
})
