import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DuoToast } from '@/components/run/DuoToast'

describe('DuoToast', () => {
  it('shows a discovery banner for a newly-discovered Duo', () => {
    render(<DuoToast duoIds={['cancrena']} />)
    expect(screen.getByText(/Cancrena scoperta!/)).toBeInTheDocument()
  })

  it('renders nothing when nothing was newly discovered', () => {
    const { container } = render(<DuoToast duoIds={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
