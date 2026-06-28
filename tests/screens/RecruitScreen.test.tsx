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

  it('lays the candidates out in a single horizontal row', () => {
    const onPick = vi.fn()
    const { container } = render(
      <RecruitScreen offer={offer} team={team} teamMax={5} onPick={onPick} />,
    )
    // Every candidate tile shares one common parent (the horizontal row),
    // and that parent uses a flex-row layout (not a stacked grid).
    const tiles = offer.map(d => screen.getByTestId(`recruit-${d.wizard.id}`))
    const rows = new Set(tiles.map(t => t.parentElement))
    expect(rows.size).toBe(1)
    const row = [...rows][0]!
    expect(row.className).toContain('flex')
    expect(row.className).toContain('flex-row')
    expect(row.className).not.toContain('grid-cols')
    // sanity: the row really contains every candidate
    expect(container).toContainElement(row)
  })

  it('keeps the synergy rail as a right-hand aside sibling of the candidates', () => {
    const onPick = vi.fn()
    const { container } = render(
      <RecruitScreen offer={offer} team={team} teamMax={5} onPick={onPick} />,
    )
    const aside = container.querySelector('aside')
    expect(aside).not.toBeNull()
    expect(aside!.textContent).toContain('Sinergie attivate')
    // The aside engages as a right column from the sm breakpoint, not only md.
    const shell = aside!.parentElement!
    expect(shell.className).toContain('sm:grid-cols-[')
  })
})
