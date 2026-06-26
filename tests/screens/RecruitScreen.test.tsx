import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RecruitScreen } from '@/components/screens/RecruitScreen'
import { offerRecruits, recruitVia } from '@/game/engine/recruit'
import { createRng } from '@/game/engine/rng'

const team = offerRecruits(createRng(1), { house: 'Tassorosso', exclude: new Set() }).slice(0, 2).map(d => recruitVia(d, 'iniziale'))
const offer = offerRecruits(createRng(2), { house: 'Tassorosso', exclude: new Set(team.map(t => t.wizard.id)) })

describe('RecruitScreen', () => {
  it('adds the picked recruit when the team has room', async () => {
    const onPick = vi.fn()
    render(<RecruitScreen offer={offer} team={team} teamMax={5} onPick={onPick} />)
    await userEvent.click(screen.getByTestId(`recruit-${offer[0]!.wizard.id}`))
    await userEvent.click(screen.getByRole('button', { name: /Recluta/ }))
    expect(onPick).toHaveBeenCalledWith(offer[0]!.wizard.id, undefined)
  })
})
