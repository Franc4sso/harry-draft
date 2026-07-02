import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Frame } from '@/components/ui/Frame'

describe('Frame', () => {
  it('wraps children in a solid inner surface and forwards testid', () => {
    render(<Frame data-testid="f">hi</Frame>)
    const el = screen.getByTestId('f')
    expect(el.className).toContain('frame-thick')
    expect(el.querySelector('.frame-inner')?.textContent).toBe('hi')
  })
})
