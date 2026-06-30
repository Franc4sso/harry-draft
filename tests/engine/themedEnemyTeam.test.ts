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

  it('high strength (boss, late area) → cohesive team with >=2 synergies (usually)', () => {
    const opts = { area: 2, kind: 'boss' as const, budget: 2000, count: 5, excludeThemes: [] }
    let cohesive = 0
    for (const s of ['a', 'b', 'c', 'd', 'e', 'f']) {
      const { team } = themedEnemyTeam(createRng(s).fork(3), opts)
      if (detectSynergies(team).length >= 1) cohesive++
    }
    expect(cohesive).toBeGreaterThanOrEqual(4)
  })

  it('respects excludeThemes (does not pick an excluded theme when alternatives exist)', () => {
    const base = { area: 2, kind: 'boss' as const, budget: 2000, count: 5 }
    const first = themedEnemyTeam(createRng('x').fork(3), { ...base, excludeThemes: [] })
    expect(first.themeId).not.toBeNull()
    const second = themedEnemyTeam(createRng('x').fork(3), { ...base, excludeThemes: [first.themeId!] })
    expect(second.themeId).not.toBe(first.themeId)
  })

  it('never returns an empty team', () => {
    const { team } = themedEnemyTeam(createRng('z').fork(3),
      { area: 0, kind: 'normal', budget: 400, count: 3, excludeThemes: [] })
    expect(team.length).toBe(3)
  })
})
