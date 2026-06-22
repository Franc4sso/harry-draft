import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from '@/components/ui/Button'
import { GlowPanel } from '@/components/ui/GlowPanel'
import { StatBar } from '@/components/ui/StatBar'

describe('Button', () => {
  it('renders children and fires onClick', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Gioca</Button>)
    await userEvent.click(screen.getByRole('button', { name: 'Gioca' }))
    expect(onClick).toHaveBeenCalledOnce()
  })
  it('does not fire when disabled', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick} disabled>Gioca</Button>)
    await userEvent.click(screen.getByRole('button', { name: 'Gioca' }))
    expect(onClick).not.toHaveBeenCalled()
  })
})

describe('GlowPanel', () => {
  it('renders children', () => {
    render(<GlowPanel>contenuto</GlowPanel>)
    expect(screen.getByText('contenuto')).toBeInTheDocument()
  })
})

describe('StatBar', () => {
  it('shows label and value', () => {
    render(<StatBar label="HP" value={80} max={120} />)
    expect(screen.getByText('HP')).toBeInTheDocument()
    expect(screen.getByText('80')).toBeInTheDocument()
  })
  it('clamps the fill width between 0 and 100%', () => {
    const { container } = render(<StatBar label="ATK" value={300} max={100} />)
    const fill = container.querySelector('[data-fill]') as HTMLElement
    expect(fill.style.width).toBe('100%')
  })
})
