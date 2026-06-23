import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RelicCard } from '@/components/relics/RelicCard'
import { RelicBar } from '@/components/relics/RelicBar'
import { RELICS } from '@/data/relics'

const relic = RELICS[0]!

describe('RelicCard', () => {
  it('shows the relic name and description', () => {
    render(<RelicCard relic={relic} />)
    expect(screen.getByText(relic.name)).toBeInTheDocument()
    expect(screen.getByText(relic.desc)).toBeInTheDocument()
  })
  it('fires onClick when clickable', async () => {
    const onClick = vi.fn()
    render(<RelicCard relic={relic} onClick={onClick} />)
    await userEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledOnce()
  })
})

describe('RelicBar', () => {
  it('lists owned relics', () => {
    render(<RelicBar relics={[{ relic, stageObtained: 0 }]} />)
    expect(screen.getByText(relic.name)).toBeInTheDocument()
  })
  it('shows an empty state with no relics', () => {
    render(<RelicBar relics={[]} />)
    expect(screen.getByText(/nessuna reliquia/i)).toBeInTheDocument()
  })
})
