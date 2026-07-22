import { describe, it, expect } from 'vitest'
import { THEMES, pickTheme, themeStrengthFor, targetThemeMembers } from '@/game/engine/combat/themes'
import { createRng } from '@/game/engine/rng'

describe('theme catalog', () => {
  it('only includes realizable themes (>=3 matching wizards)', () => {
    expect(THEMES.length).toBeGreaterThan(0)
    for (const t of THEMES) expect(t.poolSize).toBeGreaterThanOrEqual(3)
  })

  it('pickTheme is deterministic for a seed', () => {
    const rng = createRng('s1').fork(7)
    const t = pickTheme(rng, [])
    expect(t).not.toBeNull()
    const rng2 = createRng('s1').fork(7)
    expect(pickTheme(rng2, [])!.id).toBe(t!.id)
  })

  it('has exactly the two archetype themes (tag:esecuzione, tag:veleno)', () => {
    // THEMES was reduced to a single entry ('tag:veleno', from Tossicità) when the 9 team
    // synergies were removed (2026-07-21). Spietatezza (tag:esecuzione) was then DELIBERATELY
    // revived as a second archetype synergy (Carnefice Task 1, 2026-07-21/22), so THEMES now
    // derives two theme ids — sorted by id (themes.ts), 'tag:esecuzione' sorts before 'tag:veleno'.
    expect(THEMES.map(t => t.id)).toEqual(['tag:esecuzione', 'tag:veleno'])
  })

  it('excluding every theme falls back to the full set', () => {
    // pickTheme's documented fallback ("Falls back to the full set if exclusion empties the
    // pool") — excluding ALL theme ids empties the pool, so the result must still be non-null
    // and drawn from THEMES (not necessarily the same id anymore, now that there are two).
    const t = pickTheme(createRng('s1').fork(7), [])
    expect(t).not.toBeNull()
    const allIds = THEMES.map(x => x.id)
    const other = pickTheme(createRng('s1').fork(7), allIds)
    expect(other).not.toBeNull()
    expect(allIds).toContain(other!.id)
  })

  it('themeStrength rises with area and with node kind, clamped to [0,1]', () => {
    expect(themeStrengthFor(0, 'normal')).toBeLessThan(themeStrengthFor(2, 'normal'))
    expect(themeStrengthFor(1, 'normal')).toBeLessThan(themeStrengthFor(1, 'boss'))
    // monotonic and clamped even for an invented area beyond the current 3
    const s = themeStrengthFor(9, 'boss')
    expect(s).toBeGreaterThanOrEqual(0)
    expect(s).toBeLessThanOrEqual(1)
    expect(themeStrengthFor(9, 'boss')).toBeGreaterThanOrEqual(themeStrengthFor(2, 'boss'))
  })

  it('targetThemeMembers grows with strength', () => {
    expect(targetThemeMembers(0, 5)).toBeLessThan(targetThemeMembers(1, 5))
    expect(targetThemeMembers(1, 5)).toBeLessThanOrEqual(5)
    expect(targetThemeMembers(0, 5)).toBeGreaterThanOrEqual(0)
  })
})
