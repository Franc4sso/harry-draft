import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DraftProgress } from '@/components/draft/DraftProgress'

describe('DraftProgress', () => {
  it('shows the current pick number while drafting', () => {
    render(<DraftProgress picked={2} total={5} />)
    expect(screen.getByText(/Mago 3 \/ 5/i)).toBeInTheDocument()
  })
})
