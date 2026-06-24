import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Tooltip } from '@/components/ui/Tooltip'

describe('Tooltip', () => {
  it('is hidden until tapped, then reveals its content', () => {
    render(<Tooltip content="Ciao mondo" label="info"><span>i</span></Tooltip>)
    expect(screen.queryByRole('tooltip')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'info' }))
    expect(screen.getByRole('tooltip')).toHaveTextContent('Ciao mondo')
  })

  it('does not trigger a clickable ancestor when tapped (no accidental pick)', () => {
    const onParent = vi.fn()
    render(
      <div role="button" onClick={onParent}>
        <Tooltip content="x" label="info"><span>i</span></Tooltip>
      </div>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'info' }))
    expect(onParent).not.toHaveBeenCalled()
  })

  it('closes when tapping outside', () => {
    render(
      <>
        <Tooltip content="x" label="info"><span>i</span></Tooltip>
        <button>fuori</button>
      </>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'info' }))
    expect(screen.getByRole('tooltip')).toBeInTheDocument()
    fireEvent.pointerDown(screen.getByRole('button', { name: 'fuori' }))
    expect(screen.queryByRole('tooltip')).toBeNull()
  })
})
