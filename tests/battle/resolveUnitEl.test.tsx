import { describe, it, expect } from 'vitest'
import { resolveUnitEl } from '@/components/battle/PixiArena'

/**
 * FIX ROUND 1 (Task 3 review): `PixiArena`'s `centerPct` only runs inside a real Pixi/WebGL
 * stage (`createPixiStage` always fails under jsdom — no WebGL — so `centerPct` never
 * actually executes in any existing unit test). That made the duellante-preference on THIS
 * site unfalsifiable through the component itself: swapping the fixed-up selector for a bare
 * `document.querySelector('[data-unit-key=…]')` in `PixiArena.tsx` passed the full
 * `tests/ui tests/battle` run untouched, because nothing ever reached that line. The
 * selection logic is extracted to `resolveUnitEl` (pure, no Pixi dependency) specifically so
 * it can be exercised directly.
 *
 * 2026-09-16 (Task 5, "la scena, composta"): the "duellante" staging this test used to guard
 * is GONE — the scene now renders every unit as one `CartaCombat` each (no second dimmed
 * "miniatura" copy competing for the same `data-unit-key`), per the plan's ruling on
 * CONFLICT-1. Rewritten (not deleted) against the new anchor: `resolveUnitEl` must prefer
 * `[data-testid="carta-combat"]` and still fall back to the bare `[data-unit-key]` selector
 * for anything that isn't a CartaCombat. Falsified directly: reverting `resolveUnitEl` to
 * prefer `[data-testid="duellante"]` again makes the first test below fail, because no
 * element in this fixture (or in the real DOM after Task 5) carries that testid any more —
 * it would fall through to the bare selector and resolve to whichever element mounted first,
 * exactly the ambiguity this guard exists to catch.
 */
describe('resolveUnitEl', () => {
  it('prefers the carta-combat over a bare data-unit-key match when both exist', () => {
    document.body.innerHTML = `
      <div data-unit-key="right:draco"></div>
      <div data-testid="carta-combat" data-unit-key="right:draco"></div>
    `
    const el = resolveUnitEl('right', 'draco')
    expect(el).not.toBeNull()
    expect(el!.getAttribute('data-testid')).toBe('carta-combat')
  })

  it('falls back to the bare data-unit-key selector when no carta-combat carries that key', () => {
    document.body.innerHTML = `
      <div data-testid="something-else" data-unit-key="left:harry"></div>
    `
    const el = resolveUnitEl('left', 'harry')
    expect(el).not.toBeNull()
    expect(el!.getAttribute('data-testid')).toBe('something-else')
  })

  it('returns null when side or id is missing', () => {
    expect(resolveUnitEl(undefined, 'draco')).toBeNull()
    expect(resolveUnitEl('right', undefined)).toBeNull()
    expect(resolveUnitEl()).toBeNull()
  })

  it('returns null when no element carries that key at all', () => {
    document.body.innerHTML = `<div data-unit-key="left:someone-else"></div>`
    expect(resolveUnitEl('right', 'draco')).toBeNull()
  })
})
