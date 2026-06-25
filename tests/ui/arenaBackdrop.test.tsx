import { it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { ArenaBackdrop } from '@/components/battle/ArenaBackdrop'

it('renders an aria-hidden decorative layer', () => {
  const { container } = render(<ArenaBackdrop />)
  const el = container.querySelector('[data-testid="arena-backdrop"]')!
  expect(el).toBeTruthy()
  expect(el.getAttribute('aria-hidden')).toBe('true')
})
