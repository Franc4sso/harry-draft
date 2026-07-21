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

  it('excluding every theme falls back to the full set (only one theme exists post-2026-07-21)', () => {
    // THEMES was reduced to a single entry ('tag:veleno', derived from the sole remaining
    // synergy Tossicità) when the 9 team synergies were removed. pickTheme's exclusion filter
    // now always empties the pool, so its own documented fallback ("Falls back to the full set
    // if exclusion empties the pool") is what's under test — excluding the only theme id still
    // returns that same theme, not a different one.
    const t = pickTheme(createRng('s1').fork(7), [])
    expect(t).not.toBeNull()
    const other = pickTheme(createRng('s1').fork(7), [t!.id])
    expect(other!.id).toBe(t!.id)
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
