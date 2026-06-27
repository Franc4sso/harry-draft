import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LevelUpScreen } from '@/components/screens/LevelUpScreen'
import { offerRecruits, recruitVia } from '@/game/engine/recruit'
import { createRng } from '@/game/engine/rng'

const team = offerRecruits(createRng(1), { exclude: new Set() }).slice(0, 2).map(d => recruitVia(d, 'iniziale'))

describe('LevelUpScreen', () => {
  it('reports the chosen growth at the pending level', async () => {
    const onChoose = vi.fn()
    render(
      <LevelUpScreen
        pending={{ wizardId: team[0]!.wizard.id, atLevel: 3 }}
        wizard={team[0]!} team={team} synergies={[]} relics={[]} onChoose={onChoose}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: /Attacco/ }))
    expect(onChoose).toHaveBeenCalledWith({ atLevel: 3, kind: 'atk' })
  })
})
