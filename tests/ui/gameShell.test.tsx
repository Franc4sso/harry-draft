import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { GameShell } from '@/components/ui/GameShell'

describe('GameShell', () => {
  it('renders an aria-hidden, pointer-events-none ambient layer', () => {
    const { container } = render(<GameShell />)
    const root = container.firstElementChild as HTMLElement
    expect(root).toBeTruthy()
    expect(root.getAttribute('aria-hidden')).toBe('true')
    expect(root.className).toContain('pointer-events-none')
    expect(root.className).toContain('fixed')
  })

  it('renders a static ambient layer with fog blobs and no infinite animations', () => {
    const { container } = render(<GameShell />)
    // Fog blobs remain (static ambient glow).
    expect(container.querySelectorAll('[data-fog]').length).toBeGreaterThanOrEqual(2)
    // No embers (removed for perf — static background).
    expect(container.querySelectorAll('[data-ember]').length).toBe(0)
    // No element carries an infinite CSS animation.
    const animated = Array.from(container.querySelectorAll<HTMLElement>('*'))
      .filter(el => (el.getAttribute('style') ?? '').includes('animation'))
    expect(animated.length).toBe(0)
  })
})
