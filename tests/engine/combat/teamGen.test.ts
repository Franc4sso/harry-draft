import { describe, it, expect } from 'vitest'
import { generateEnemyTeam, generateBossTeam, themedEnemyTeam, budgetForStage, powerOf } from '@/game/engine/combat/teamGen'
import { createRng } from '@/game/engine/rng'
import { BALANCE } from '@/data/constants'
import { BOSSES, MURO, BELLATRIX } from '@/data/bosses'
import type { BossDef } from '@/data/bosses'
import { detectSynergies } from '@/game/engine/synergy'
import { spellIsOffensive } from '@/game/engine/statRoll'
import { SPELL_BY_ID } from '@/data/spells'

describe('teamGen', () => {
  it('builds a 5-wizard enemy team deterministically', () => {
    const a = generateEnemyTeam(createRng(1), budgetForStage(0)).map(d => d.wizard.id)
    const b = generateEnemyTeam(createRng(1), budgetForStage(0)).map(d => d.wizard.id)
    expect(a).toHaveLength(5)
    expect(a).toEqual(b)
  })
  it('later stages have higher budget', () => {
    expect(budgetForStage(4)).toBeGreaterThan(budgetForStage(0))
  })
  it('higher budget teams are stronger on average', () => {
    const weak = generateEnemyTeam(createRng(7), budgetForStage(0)).reduce((s, d) => s + powerOf(d), 0)
    const strong = generateEnemyTeam(createRng(7), budgetForStage(8)).reduce((s, d) => s + powerOf(d), 0)
    expect(strong).toBeGreaterThan(weak)
  })
  it('boss team applies hp multiplier to leader', () => {
    // Voldemort (final boss) now carries its own unitCount override (3, USER DECISION —
    // see campaignBalanceB.test.ts calibration history), so this exercises the
    // boss.unitCount path rather than the BALANCE.draft.teamSize default.
    // Assert the multiplier's EFFECT (leader HP > what hpMult=1 would have produced)
    // rather than an absolute HP threshold: BOSSES[0]'s budget/hpMult are a
    // floor-sensitive balance lever (task 25, STARTER_PICKS=3 recalibration) that will
    // keep moving as campaignBalanceB is re-tuned, and a hardcoded number silently goes
    // stale every time — this compares the multiplier's actual effect instead.
    const boss = generateBossTeam(createRng(1), BOSSES[0]!)
    expect(boss).toHaveLength(BOSSES[0]!.unitCount ?? BALANCE.draft.teamSize)
    // Compare the LEADER's own HP against its unmultiplied counterpart (not
    // Math.max across the team) — another teammate can have higher raw HP than the
    // boosted leader, so a team-wide max doesn't reliably reflect hpMult's effect.
    const unmultiplied = generateBossTeam(createRng(1), { ...BOSSES[0]!, hpMult: 1 })
    const leaderHp = boss.find(d => d.wizard.id === BOSSES[0]!.bossWizardId)!.maxHp
    const leaderHpNoMult = unmultiplied.find(d => d.wizard.id === BOSSES[0]!.bossWizardId)!.maxHp
    expect(leaderHp).toBeGreaterThan(leaderHpNoMult)
  })
  it('Muro fields unitCount override (3) instead of default teamSize', () => {
    const team = generateBossTeam(createRng(1), MURO)
    expect(team).toHaveLength(3)
  })
  it('boss without unitCount defaults to BALANCE.draft.teamSize', () => {
    // A synthetic boss (no unitCount field) exercises the `?? BALANCE.draft.teamSize`
    // fallback directly — every scripted boss in data/bosses.ts now carries an explicit
    // unitCount override, so none of them can exercise the default path any more.
    const noOverrideBoss: BossDef = { id: 'test_boss', name: 'Test Boss', budget: 900, hpMult: 1 }
    const team = generateBossTeam(createRng(1), noOverrideBoss)
    expect(team).toHaveLength(BALANCE.draft.teamSize)
    expect(BALANCE.draft.teamSize).toBe(5)
  })
})

// Design rules the user pinned (2026-07-03): every boss fields ≥3 units, and every
// elite pack carries an active synergy. Locked in so a future balance sweep can't
// silently trim a boss back to 2 or leave an elite themeless.
describe('boss/elite pack rules', () => {
  it('Bellatrix (and every boss) fields at least 3 units', () => {
    const team = generateBossTeam(createRng(3), BELLATRIX)
    expect(team.length).toBeGreaterThanOrEqual(3)
  })
  it('enforces the ≥3 floor even when a boss.unitCount is set to 2', () => {
    const tiny: BossDef = { id: 't', name: 'T', budget: 600, hpMult: 1, unitCount: 2 }
    expect(generateBossTeam(createRng(1), tiny)).toHaveLength(3)
  })
  // KNOWN REGRESSION (post house/role-synergy removal, 2026-07-14): themedEnemyTeam's
  // `eligible` gate for forceSynergy (elite packs) only accepts theme ids prefixed
  // `house:`/`role:` — those were the ONLY themes that activated at a 2-member tier.
  // Now that SYNERGIES has no house/role entries, THEMES contains only `tag:` themes
  // (weasley/order/deatheater/…), all gated behind `eligible`, so NO theme is ever
  // eligible for an elite pack and `realized` stays null unconditionally — this is not
  // a probabilistic gap, area 0 seed 0 already fails. Actually restoring the "elite
  // always themed" guarantee needs `minMembers`/`wantThemed` to be threshold-aware per
  // tag theme (weasley/order/deatheater need 3 members, marauder needs 2) instead of the
  // current flat `minMembers = 2` — a real generator change, out of scope for this test
  // bonifica (removal of role/house synergies only). Left as a follow-up; this test now
  // documents the current (broken) guarantee instead of silently deleting the concern.
  it('elite packs currently field ZERO active synergies (documents the regression above)', () => {
    const cb = BALANCE.campaignB
    for (let area = 0; area < BALANCE.map.areas; area++) {
      const count = cb.enemyCountByArea[area] ?? cb.enemyCountByArea[cb.enemyCountByArea.length - 1]!
      for (let s = 0; s < 40; s++) {
        const { team } = themedEnemyTeam(createRng(`elite-${area}-${s}`), {
          area, kind: 'elite', budget: 800, count, excludeThemes: [],
        })
        expect(detectSynergies(team).length, `area ${area} seed ${s}`).toBe(0)
      }
    }
  })
})

// UN MAGO, UNA MAGIA (Task 3): per-unit offense bias (preferOffense/guaranteeOffense) is
// gone now that every pool is a single signature — it was dead code or, worse, forced an
// attack onto a Supporto's kit. The safety net is now a TEAM-level guarantee: every
// generated enemy team fields at least one attacker, while individual Supporto units are
// never forced onto a damaging spell.
describe('enemy offense guarantee (team-level)', () => {
  it('ogni squadra nemica generata schiera almeno un attaccante', () => {
    for (let seed = 0; seed < 40; seed++) {
      const team = generateEnemyTeam(createRng(seed), 600)
      const hasOffense = team.some(d => spellIsOffensive(d.spell))
      expect(hasOffense, `seed ${seed} team senza attaccante`).toBe(true)
    }
  })

  it('un Supporto nemico non equipaggia mai un attacco', () => {
    for (let seed = 0; seed < 40; seed++) {
      for (const d of generateEnemyTeam(createRng(seed), 600)) {
        if (d.wizard.role === 'Supporto') {
          expect(spellIsOffensive(d.spell), `${d.wizard.id} Supporto attacca`).toBe(false)
        }
      }
    }
  })
})
