import { describe, it, expect } from 'vitest'
import { buildBattlePackage } from '@/game/engine/combat/battlePackage'
import { generateBossTeam } from '@/game/engine/combat/teamGen'
import { createRng } from '@/game/engine/rng'
import { spellIsOffensive } from '@/game/engine/statRoll'
import { MURO_ALT } from '@/data/bosses'
import { WIZARD_BY_ID } from '@/data/wizards'
import { SPELL_BY_ID } from '@/data/spells'
import type { Role } from '@/types'

// Regression guard for the "degenerate enemy" bug: an enemy TEAM whose every equipped
// active spell never deals damage is a free win for the player. UN MAGO, UNA MAGIA
// (Task 3) removed the per-unit offense guarantee (guaranteeOffensiveSpell / draftWizard's
// preferOffense+guaranteeOffense) — forcing an individual Supporto onto an attack
// contradicted "supports don't attack". The safety net now lives at the TEAM level
// (teamGen.ts's ensureOffense): every generated enemy team fields at least one attacker,
// while individual Supporto units are never forced onto a damaging spell.
describe('attack move guarantee — enemy elite/boss (team-level)', () => {
  it('every ELITE battle fields a team with at least one offensive active spell (many seeds/areas)', () => {
    const offenders: string[] = []
    for (let area = 0; area < 3; area++) {
      for (let floor = 0; floor < 5; floor++) {
        for (let s = 0; s < 30; s++) {
          const { battle } = buildBattlePackage(`elite-${area}-${floor}-${s}`, area, floor, 'elite')
          const hasOffense = battle.enemyTeam.some(dw => spellIsOffensive(dw.spell))
          if (!hasOffense) offenders.push(`area${area} floor${floor} seed${s}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('every BOSS battle fields a team with at least one offensive active spell (many seeds/areas)', () => {
    const offenders: string[] = []
    for (let area = 0; area < 3; area++) {
      for (let floor = 0; floor < 5; floor++) {
        for (let s = 0; s < 30; s++) {
          const { battle } = buildBattlePackage(`boss-${area}-${floor}-${s}`, area, floor, 'boss')
          const hasOffense = battle.enemyTeam.some(dw => spellIsOffensive(dw.spell))
          if (!hasOffense) offenders.push(`area${area} floor${floor} seed${s}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('the MURO_ALT (marcus) leader ends up with an offensive active spell', () => {
    // Leader was pettigrew (a Supporto) — replaced by marcus (Serpeverde Attaccante) because
    // no Supporto may be a boss-leader this slice. marcus's own signature is offensive
    // (pool-of-1), so the invariant holds natively here — no per-unit guarantee needed.
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

  it('pettigrew (pure-support Supporto) never equips an offensive spell, even when fielded on an elite/boss team', () => {
    // USER DECISION 2026-07-07/Task 3: enemy elite/boss teams may field ≤1 Supporto, and
    // that Supporto is NEVER forced onto an attack any more — the team-level guarantee
    // (proven above) covers the "toothless enemy" risk instead.
    const pettigrew = WIZARD_BY_ID['pettigrew']!
    expect(pettigrew.spellPool.some(id => spellIsOffensive(SPELL_BY_ID[id]))).toBe(false)
    let sawPettigrew = false
    for (let area = 0; area < 3; area++) {
      for (let floor = 0; floor < 5; floor++) {
        for (let s = 0; s < 20; s++) {
          for (const kind of ['elite', 'boss'] as const) {
            const { battle } = buildBattlePackage(`pettigrew-${kind}-${area}-${floor}-${s}`, area, floor, kind)
            const dw = battle.enemyTeam.find(d => d.wizard.id === 'pettigrew')
            if (dw) {
              sawPettigrew = true
              expect(spellIsOffensive(dw.spell), `${kind} area${area} floor${floor} seed${s} → ${dw.spell.id}`).toBe(false)
            }
          }
        }
      }
    }
    expect(sawPettigrew, 'pettigrew never appeared in the sweep — cannot exercise the invariant').toBe(true)
  })

  it('enemy elite/boss teams field AT MOST 1 Supporto, alongside other roles (many seeds/areas)', () => {
    // USER DECISION (Task 3c): Supporto is no longer excluded from enemy elite/boss drafts —
    // it is capped at ≤1 per fielded team, and the rest of the roster must still show role
    // variety (never a mono-Supporto or all-support-heavy squad). This also proves Supporto
    // CAN appear at all now (not fully excluded): we track whether at least one team across
    // the sweep contains exactly 1 Supporto.
    let sawExactlyOneSupporto = false
    const violations: string[] = []
    for (const kind of ['elite', 'boss'] as const) {
      for (let area = 0; area < 3; area++) {
        for (let floor = 0; floor < 5; floor++) {
          for (let s = 0; s < 30; s++) {
            const { battle } = buildBattlePackage(`${kind}-comp-${area}-${floor}-${s}`, area, floor, kind)
            const roles = battle.enemyTeam.map(dw => dw.wizard.role as Role)
            const supportoCount = roles.filter(r => r === 'Supporto').length
            if (supportoCount > 1) {
              violations.push(`${kind} area${area} floor${floor} seed${s}: ${supportoCount} Supporto`)
            }
            if (supportoCount === 1) sawExactlyOneSupporto = true
            if (roles.length >= 3) {
              const nonSupporto = roles.filter(r => r !== 'Supporto').length
              if (nonSupporto === 0) {
                violations.push(`${kind} area${area} floor${floor} seed${s}: no role variety (all Supporto)`)
              }
            }
          }
        }
      }
    }
    expect(violations).toEqual([])
    expect(sawExactlyOneSupporto, 'no swept team ever fielded exactly 1 Supporto — Supporto still excluded?').toBe(true)
  })
})
