import { it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { ArenaBackdrop } from '@/components/battle/ArenaBackdrop'

it('renders an aria-hidden decorative layer', () => {
  const { container } = render(<ArenaBackdrop />)
  const el = container.querySelector('[data-testid="arena-backdrop"]')!
  expect(el).toBeTruthy()
  expect(el.getAttribute('aria-hidden')).toBe('true')
})

it('is a static backdrop — no per-frame animation behind combat (perf)', () => {
  // The arena backdrop must not run continuous animations: the replay only reveals a
  // frame a few times per second, but infinite loops here repaint the whole arena every
  // compositor frame (and each unit's backdrop-blur re-samples it). Static keeps the look
  // while the GPU only paints during actual attack VFX. Attack VFX live in SpellFx/UnitBust.
  const { container } = render(<ArenaBackdrop />)
  const root = container.querySelector('[data-testid="arena-backdrop"]')!
  // No animated blur filter (the old drifting haze used blur(9px)).
  expect(root.outerHTML).not.toMatch(/blur\(\s*9px/)
  // Ember scatter is present but static (rendered as plain motes, no motion transform state).
  const embers = root.querySelectorAll('[data-ember]')
  expect(embers.length).toBeGreaterThan(0)
  embers.forEach(e => {
    const style = e.getAttribute('style') ?? ''
    expect(style).not.toMatch(/animation|transform:\s*translate/i)
  })
})
