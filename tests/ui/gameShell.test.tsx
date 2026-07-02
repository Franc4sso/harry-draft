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

  it('renders ember particles and fog layers', () => {
    const { container } = render(<GameShell />)
    expect(container.querySelectorAll('[data-ember]').length).toBeGreaterThan(8)
    expect(container.querySelectorAll('[data-fog]').length).toBeGreaterThanOrEqual(2)
  })
})
