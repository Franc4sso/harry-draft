// tests/screens/MenuTutorial.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MenuScreen } from '@/components/screens/MenuScreen'
import { PROFILE_KEY } from '@/lib/metaStore'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

describe('MenuScreen — tutorial entry', () => {
  beforeEach(() => { push.mockClear(); localStorage.removeItem(PROFILE_KEY) })

  it('shows a Tutorial button and, on a fresh profile, the nudge', () => {
    render(<MenuScreen />)
    expect(screen.getByTestId('tutorial-cta')).toBeInTheDocument()
    expect(screen.getByTestId('tutorial-nudge')).toBeInTheDocument()
  })
  it('clicking Tutorial navigates with ?tutorial=1 and marks the nudge seen', () => {
    render(<MenuScreen />)
    fireEvent.click(screen.getByTestId('tutorial-cta'))
    expect(push).toHaveBeenCalledWith('/play?tutorial=1')
    // re-render: nudge gone
    render(<MenuScreen />)
    expect(screen.queryAllByTestId('tutorial-nudge').length).toBe(0)
  })
})
