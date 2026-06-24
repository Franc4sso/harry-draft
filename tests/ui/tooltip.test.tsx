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

  it('keeps a caller-supplied position class instead of forcing `relative`', () => {
    // `cn` does no Tailwind conflict resolution, so emitting both `relative`
    // and a caller `absolute` would let the cascade pick `relative` and drop
    // the badge out of its corner. The wrapper must stay purely `absolute`.
    const { container } = render(
      <Tooltip content="x" label="info" className="absolute bottom-2 left-2">
        <span>i</span>
      </Tooltip>,
    )
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.className).toContain('absolute')
    expect(wrapper.className).not.toContain('relative')
  })

  it('defaults to `relative` so the popover anchors when unpositioned', () => {
    const { container } = render(
      <Tooltip content="x" label="info"><span>i</span></Tooltip>,
    )
    expect((container.firstElementChild as HTMLElement).className).toContain('relative')
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
