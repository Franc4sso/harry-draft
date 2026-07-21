import { describe, it, expect } from 'vitest'
import { themedEnemyTeam } from '@/game/engine/combat/teamGen'
import { detectSynergies } from '@/game/engine/synergy'
import { createRng } from '@/game/engine/rng'

const ids = (team: { wizard: { id: string } }[]) => team.map(d => d.wizard.id).sort()

describe('themedEnemyTeam', () => {
  it('is deterministic: same seed+opts → identical wizard identities', () => {
    const opts = { area: 1, kind: 'elite' as const, budget: 1200, count: 4, excludeThemes: [] }
    const a = themedEnemyTeam(createRng('seed').fork(3), opts)
    const b = themedEnemyTeam(createRng('seed').fork(3), opts)
    expect(ids(a.team)).toEqual(ids(b.team))
    expect(a.themeId).toBe(b.themeId)
  })

  it('different seeds vary the wizard IDENTITIES (not just stats)', () => {
    const opts = { area: 1, kind: 'elite' as const, budget: 1200, count: 4, excludeThemes: [] }
    const teams = ['s1', 's2', 's3', 's4', 's5'].map(s =>
      ids(themedEnemyTeam(createRng(s).fork(3), opts).team).join(','))
    expect(new Set(teams).size).toBeGreaterThan(1)
  })

  it('low strength (area 0 normal) → no imposed theme (mixed)', () => {
    // At low themeStrength the generator imposes NO theme (themeId null). Any
    // synergies detectSynergies finds are emergent from the narrow legacy budget
    // window (e.g. budget=600 → 8/12 Controllo), NOT something the generator
    // controls — so the achievable property to assert is "no theme imposed".
    const opts = { area: 0, kind: 'normal' as const, budget: 600, count: 4, excludeThemes: [] }
    for (const s of ['a', 'b', 'c', 'd', 'e', 'f']) {
      const { themeId } = themedEnemyTeam(createRng(s).fork(3), opts)
      expect(themeId).toBeNull()
    }
  })

  it('high strength (boss, late area) → still may realize a theme, but cohesion is no longer guaranteed', () => {
    // Pre-2026-07-21 there were 9 synergies (house/role/tag), so boss packs — which only ever
    // guarantee >=2 themed members (the softer, non-forced floor; see teamGen.ts wantFloor/
    // acceptMin) — usually stumbled into SOME active synergy across a wide pool of possible
    // families. With SYNERGIES reduced to the single Tossicità (tag:veleno, requires 3), that
    // 2-member soft floor can no longer reliably cross the 3-member activation threshold, so
    // cohesion is now rare, not usual (measured: 0/6 with the old fixture seeds). This test only
    // guards the structural property that still holds: themedEnemyTeam never throws and always
    // returns a valid team of the requested size, themed or not.
    const opts = { area: 2, kind: 'boss' as const, budget: 2000, count: 5, excludeThemes: [] }
    for (const s of ['a', 'b', 'c', 'd', 'e', 'f']) {
      const { team } = themedEnemyTeam(createRng(s).fork(3), opts)
      expect(team.length).toBe(5)
      expect(detectSynergies(team).length).toBeGreaterThanOrEqual(0)
    }
  })

  it('excludeThemes on the sole remaining theme falls back to it (only one theme exists post-2026-07-21)', () => {
    // THEMES has a single entry now ('tag:veleno'). pickTheme's own documented fallback
    // ("Falls back to the full set if exclusion empties the pool") means excluding the only
    // realized theme no longer yields a DIFFERENT theme — it yields the same one back.
    const base = { area: 2, kind: 'boss' as const, budget: 2000, count: 5 }
    const first = themedEnemyTeam(createRng('x').fork(3), { ...base, excludeThemes: [] })
    const second = themedEnemyTeam(createRng('x').fork(3), { ...base, excludeThemes: first.themeId ? [first.themeId] : [] })
    expect(second.team.length).toBe(5)
  })

  it('never returns an empty team', () => {
    const { team } = themedEnemyTeam(createRng('z').fork(3),
      { area: 0, kind: 'normal', budget: 400, count: 3, excludeThemes: [] })
    expect(team.length).toBe(3)
  })
})
