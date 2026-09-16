import { describe, it, expect } from 'vitest'
import { resolveUnitEl } from '@/components/battle/PixiArena'

/**
 * FIX ROUND 1 (review): `PixiArena`'s `centerPct` only runs inside a real Pixi/WebGL stage
 * (`createPixiStage` always fails under jsdom — no WebGL — so `centerPct` never actually
 * executes in any existing unit test). That made the duellante-preference on THIS site
 * unfalsifiable through the component itself: swapping the fixed-up selector for a bare
 * `document.querySelector('[data-unit-key=…]')` in `PixiArena.tsx` passed the full
 * `tests/ui tests/battle` run untouched, because nothing ever reached that line. The
 * selection logic is extracted to `resolveUnitEl` (pure, no Pixi dependency) specifically so
 * it can be exercised directly, the same way BattleArena's copy of the guard is now covered
 * in `tests/ui/battle.test.tsx`.
 */
describe('resolveUnitEl', () => {
  it('prefers the duellante over the miniature when a unit is staged (data-unit-key on both)', () => {
    document.body.innerHTML = `
      <div data-testid="miniatura" data-unit-key="right:draco"></div>
      <div data-testid="duellante" data-unit-key="right:draco"></div>
    `
    const el = resolveUnitEl('right', 'draco')
    expect(el).not.toBeNull()
    expect(el!.getAttribute('data-testid')).toBe('duellante')
  })

  it('still resolves the miniature when the unit is NOT staged (no duellante in the DOM)', () => {
    document.body.innerHTML = `
      <div data-testid="miniatura" data-unit-key="left:harry"></div>
    `
    const el = resolveUnitEl('left', 'harry')
    expect(el).not.toBeNull()
    expect(el!.getAttribute('data-testid')).toBe('miniatura')
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
