import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RecruitScreen } from '@/components/screens/RecruitScreen'
import { offerRecruits, recruitVia } from '@/game/engine/recruit'
import { createRng } from '@/game/engine/rng'

const team = offerRecruits(createRng(1), { exclude: new Set() }).slice(0, 2).map(d => recruitVia(d, 'iniziale'))
const offer = offerRecruits(createRng(2), { exclude: new Set(team.map(t => t.wizard.id)) })

describe('RecruitScreen', () => {
  it('adds the picked recruit when the team has room', async () => {
    const onPick = vi.fn()
    render(<RecruitScreen offer={offer} team={team} teamMax={5} onPick={onPick} />)
    await userEvent.click(screen.getByTestId(`recruit-${offer[0]!.wizard.id}`))
    await userEvent.click(screen.getByRole('button', { name: /Recluta/ }))
    expect(onPick).toHaveBeenCalledWith(offer[0]!.wizard.id, undefined)
  })

  it('renders candidates as horizontal (landscape) cards, like the draft', () => {
    const onPick = vi.fn()
    render(<RecruitScreen offer={offer} team={team} teamMax={5} onPick={onPick} />)
    // Each candidate uses the draft's horizontal WizardCardRow (`.wizard-row`),
    // NOT the portrait WizardCard — so recruiting reads like the draft.
    for (const d of offer) {
      const tile = screen.getByTestId(`recruit-${d.wizard.id}`)
      expect(tile.querySelector('.wizard-row')).not.toBeNull()
    }
  })

  it('stacks the candidates in a single vertical column (like the draft section)', () => {
    const onPick = vi.fn()
    render(<RecruitScreen offer={offer} team={team} teamMax={5} onPick={onPick} />)
    const tiles = offer.map(d => screen.getByTestId(`recruit-${d.wizard.id}`))
    const cols = new Set(tiles.map(t => t.parentElement))
    expect(cols.size).toBe(1)
    const col = [...cols][0]!
    expect(col.tagName.toLowerCase()).toBe('section')
    expect(col.className).toContain('grid-cols-1')
  })

  it('keeps the synergy rail as a right-hand aside sibling of the candidates', () => {
    const onPick = vi.fn()
    const { container } = render(
      <RecruitScreen offer={offer} team={team} teamMax={5} onPick={onPick} />,
    )
    const aside = container.querySelector('aside')
    expect(aside).not.toBeNull()
    expect(aside!.textContent).toContain('Sinergie attivate')
    // Layout mirrors the draft exactly: the candidates + rail live in a two-column
    // grid (md:grid-cols-[1fr_280px]); the aside is its right-hand column.
    const shell = aside!.parentElement!
    expect(shell.className).toContain('md:grid-cols-[1fr_280px]')
    expect(shell.querySelector('section')).not.toBeNull()
  })
})
