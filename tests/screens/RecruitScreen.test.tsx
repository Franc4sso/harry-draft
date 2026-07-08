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
  }, 15000)

  it('calls onSkip when declining the offer', async () => {
    const onPick = vi.fn()
    const onSkip = vi.fn()
    render(<RecruitScreen offer={offer} team={team} teamMax={5} onPick={onPick} onSkip={onSkip} />)
    await userEvent.click(screen.getByRole('button', { name: /Non reclutare/i }))
    expect(onSkip).toHaveBeenCalled()
    expect(onPick).not.toHaveBeenCalled()
  })

  it('when the squad is full, offers a no-replace skip and a swap roster', async () => {
    const onPick = vi.fn()
    const onSkip = vi.fn()
    // teamMax === team length ⇒ full, without needing five members
    render(<RecruitScreen offer={offer} team={team} teamMax={team.length} onPick={onPick} onSkip={onSkip} />)
    // every roster member is a tappable replace target (div, not a nested <button>)
    for (const t of team) {
      const tile = screen.getByTestId(`replace-${t.wizard.id}`)
      expect(tile.tagName.toLowerCase()).toBe('div')
    }
    await userEvent.click(screen.getByRole('button', { name: /Non sostituire nessuno/i }))
    expect(onSkip).toHaveBeenCalled()
  }, 15000)

  it('renders candidates as horizontal (landscape) cards, like the draft', () => {
    const onPick = vi.fn()
    render(<RecruitScreen offer={offer} team={team} teamMax={5} onPick={onPick} />)
    // Each candidate uses the SAME poster card as the first draft (WizardCardColumn,
    // `.wizard-col`) — recruiting looks identical to the draft.
    for (const d of offer) {
      const tile = screen.getByTestId(`recruit-${d.wizard.id}`)
      expect(tile.querySelector('.wizard-col')).not.toBeNull()
    }
  })

  it('lays the candidates out side by side (a responsive grid, like the draft row)', () => {
    const onPick = vi.fn()
    render(<RecruitScreen offer={offer} team={team} teamMax={5} onPick={onPick} />)
    const tiles = offer.map(d => screen.getByTestId(`recruit-${d.wizard.id}`))
    const cols = new Set(tiles.map(t => t.parentElement))
    expect(cols.size).toBe(1)
    const col = [...cols][0]!
    expect(col.tagName.toLowerCase()).toBe('section')
    // multi-column at wider breakpoints (poster cards side by side, not a single stack)
    expect(col.className).toContain('lg:grid-cols-3')
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

  describe('dead wizard in the replace picker', () => {
    // Build a full team of 2 wizards where index 0 is dead (currentHp = 0).
    const deadMember = { ...recruitVia(offerRecruits(createRng(10), { exclude: new Set() })[0]!, 'test'), currentHp: 0 }
    const livingMember = recruitVia(offerRecruits(createRng(10), { exclude: new Set([deadMember.wizard.id]) })[0]!, 'test')
    const mixedTeam = [deadMember, livingMember]
    const mixedOffer = offerRecruits(createRng(20), { exclude: new Set(mixedTeam.map(t => t.wizard.id)) })

    it('dead wizard appears in the replace picker (is NOT filtered out)', () => {
      const onPick = vi.fn()
      render(
        <RecruitScreen offer={mixedOffer} team={mixedTeam} teamMax={mixedTeam.length} onPick={onPick} />,
      )
      // Both members must appear as replace tiles
      expect(screen.getByTestId(`replace-${deadMember.wizard.id}`)).toBeTruthy()
      expect(screen.getByTestId(`replace-${livingMember.wizard.id}`)).toBeTruthy()
    })

    it('dead wizard shows a "Morto" badge in the replace picker', () => {
      const onPick = vi.fn()
      render(
        <RecruitScreen offer={mixedOffer} team={mixedTeam} teamMax={mixedTeam.length} onPick={onPick} />,
      )
      const badge = screen.getByTestId(`dead-badge-${deadMember.wizard.id}`)
      expect(badge.textContent?.toLowerCase()).toContain('morto')
    })

    it('dead wizard is selectable as the replace target and fires onPick with its id', async () => {
      const onPick = vi.fn()
      render(
        <RecruitScreen offer={mixedOffer} team={mixedTeam} teamMax={mixedTeam.length} onPick={onPick} />,
      )
      // Select the recruit
      await userEvent.click(screen.getByTestId(`recruit-${mixedOffer[0]!.wizard.id}`))
      // Click on the dead wizard's replace tile
      await userEvent.click(screen.getByTestId(`replace-${deadMember.wizard.id}`))
      // Confirm the pick
      await userEvent.click(screen.getByRole('button', { name: /Recluta/i }))
      expect(onPick).toHaveBeenCalledWith(mixedOffer[0]!.wizard.id, deadMember.wizard.id)
    })
  })
})
