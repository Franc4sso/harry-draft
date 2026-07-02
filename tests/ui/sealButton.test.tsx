import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SealButton } from '@/components/ui/SealButton'

describe('SealButton', () => {
  it('fires onClick and applies seal material', async () => {
    const fn = vi.fn()
    render(<SealButton onClick={fn}>Gioca</SealButton>)
    const b = screen.getByRole('button', { name: 'Gioca' })
    expect(b.className).toContain('seal')
    await userEvent.click(b)
    expect(fn).toHaveBeenCalledOnce()
  })
})
