import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RecruitScreen } from '@/components/screens/RecruitScreen'
import { offerRecruits, recruitVia } from '@/game/engine/recruit'
import { createRng } from '@/game/engine/rng'

const team = offerRecruits(createRng(1), { exclude: new Set() }).slice(0, 2).map(d => recruitVia(d, 'iniziale', 1))
const offer = offerRecruits(createRng(2), { exclude: new Set(team.map(t => t.wizard.id)) })

describe('RecruitScreen — noRecruits (Voto Infrangibile)', () => {
  it('shows the blocked reason and disables the Recluta action', () => {
    const onPick = vi.fn()
    render(<RecruitScreen offer={offer} team={team} teamMax={5} onPick={onPick} relics={[]} noRecruits />)
    expect(screen.getByText(/Il Voto Infrangibile è stato giurato/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Recluta/ })).toBeDisabled()
  })

  it('without noRecruits, no blocked reason is shown and Recluta stays available once picked', async () => {
    const onPick = vi.fn()
    render(<RecruitScreen offer={offer} team={team} teamMax={5} onPick={onPick} relics={[]} />)
    expect(screen.queryByText(/Voto Infrangibile/i)).toBeNull()
  })
})
