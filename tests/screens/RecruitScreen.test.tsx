import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RecruitScreen } from '@/components/screens/RecruitScreen'
import { offerRecruits, recruitVia } from '@/game/engine/recruit'
import { createRng } from '@/game/engine/rng'
import { draftWizard } from '@/game/engine/statRoll'
import { WIZARD_BY_ID } from '@/data/wizards'

const team = offerRecruits(createRng(1), { exclude: new Set() }).slice(0, 2).map(d => recruitVia(d, 'iniziale', 1))
const offer = offerRecruits(createRng(2), { exclude: new Set(team.map(t => t.wizard.id)) })

describe('RecruitScreen', () => {
  it('adds the picked recruit when the team has room', async () => {
    const onPick = vi.fn()
    render(<RecruitScreen offer={offer} team={team} teamMax={5} onPick={onPick} relics={[]} />)
    await userEvent.click(screen.getByTestId(`recruit-${offer[0]!.wizard.id}`))
    await userEvent.click(screen.getByRole('button', { name: /Recluta/ }))
    expect(onPick).toHaveBeenCalledWith(offer[0]!.wizard.id, undefined)
  }, 15000)

  it('calls onSkip when declining the offer', async () => {
    const onPick = vi.fn()
    const onSkip = vi.fn()
    render(<RecruitScreen offer={offer} team={team} teamMax={5} onPick={onPick} onSkip={onSkip} relics={[]} />)
    await userEvent.click(screen.getByRole('button', { name: /Non reclutare/i }))
    expect(onSkip).toHaveBeenCalled()
    expect(onPick).not.toHaveBeenCalled()
  })

  it('when the squad is full, offers a no-replace skip and a swap roster', async () => {
    const onPick = vi.fn()
    const onSkip = vi.fn()
    // teamMax === team length ⇒ full, without needing five members
    render(<RecruitScreen offer={offer} team={team} teamMax={team.length} onPick={onPick} onSkip={onSkip} relics={[]} />)
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
    render(<RecruitScreen offer={offer} team={team} teamMax={5} onPick={onPick} relics={[]} />)
    // Each candidate uses the SAME poster card as the first draft (WizardCardColumn,
    // `.wizard-col`) — recruiting looks identical to the draft.
    for (const d of offer) {
      const tile = screen.getByTestId(`recruit-${d.wizard.id}`)
      expect(tile.querySelector('.wizard-col')).not.toBeNull()
    }
  })

  it('lays the candidates out side by side (a responsive grid, like the draft row)', () => {
    const onPick = vi.fn()
    render(<RecruitScreen offer={offer} team={team} teamMax={5} onPick={onPick} relics={[]} />)
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
      <RecruitScreen offer={offer} team={team} teamMax={5} onPick={onPick} relics={[]} />,
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
    const deadMember = { ...recruitVia(offerRecruits(createRng(10), { exclude: new Set() })[0]!, 'test', 1), currentHp: 0 }
    const livingMember = recruitVia(offerRecruits(createRng(10), { exclude: new Set([deadMember.wizard.id]) })[0]!, 'test', 1)
    const mixedTeam = [deadMember, livingMember]
    const mixedOffer = offerRecruits(createRng(20), { exclude: new Set(mixedTeam.map(t => t.wizard.id)) })

    it('dead wizard appears in the replace picker (is NOT filtered out)', () => {
      const onPick = vi.fn()
      render(
        <RecruitScreen offer={mixedOffer} team={mixedTeam} teamMax={mixedTeam.length} onPick={onPick} relics={[]} />,
      )
      // Both members must appear as replace tiles
      expect(screen.getByTestId(`replace-${deadMember.wizard.id}`)).toBeTruthy()
      expect(screen.getByTestId(`replace-${livingMember.wizard.id}`)).toBeTruthy()
    })

    it('dead wizard shows a "Morto" badge in the replace picker', () => {
      const onPick = vi.fn()
      render(
        <RecruitScreen offer={mixedOffer} team={mixedTeam} teamMax={mixedTeam.length} onPick={onPick} relics={[]} />,
      )
      const badge = screen.getByTestId(`dead-badge-${deadMember.wizard.id}`)
      expect(badge.textContent?.toLowerCase()).toContain('morto')
    })

    it('dead wizard is selectable as the replace target and fires onPick with its id', async () => {
      const onPick = vi.fn()
      render(
        <RecruitScreen offer={mixedOffer} team={mixedTeam} teamMax={mixedTeam.length} onPick={onPick} relics={[]} />,
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

  describe('duo preview ribbon', () => {
    // pansy + theodore are both 'veleno'-tagged (2 ⇒ the veleno signal is already lit by the
    // team alone); draco is 'esecuzione'-tagged (only 1 ⇒ esecuzione is NOT yet lit — one away).
    // Recruiting marcus (also 'esecuzione'-tagged) brings esecuzione to 2 ⇒ lit, completing the
    // 'cancrena' Duo (veleno + esecuzione).
    const pansy = draftWizard(createRng(1), WIZARD_BY_ID['pansy']!)
    const theodore = draftWizard(createRng(2), WIZARD_BY_ID['theodore']!)
    const draco = draftWizard(createRng(3), WIZARD_BY_ID['draco']!)
    const marcus = draftWizard(createRng(4), WIZARD_BY_ID['marcus']!)
    const duoTeam = [pansy, theodore, draco]

    it('shows a completes ribbon on an offer candidate that completes a Duo with the team', () => {
      const onPick = vi.fn()
      render(<RecruitScreen offer={[marcus]} team={duoTeam} teamMax={5} onPick={onPick} relics={[]} />)
      const tile = screen.getByTestId(`recruit-${marcus.wizard.id}`)
      const ribbon = screen.getByTestId('duo-ribbon')
      expect(tile.contains(ribbon)).toBe(true)
      expect(ribbon).toHaveAttribute('data-kind', 'completes')
      expect(ribbon).toHaveTextContent('Cancrena')
    })

    // ernie is a Tank (lights 'taunt' with just 1) AND 'scudirigen'-tagged (needs 2, so it stays
    // unlit with only 1). Against an EMPTY team (both signals two-away), recruiting ernie moves
    // the 'muro-vivente' Duo (scudirigen + taunt) from two-away to one-away — an advance, not a
    // completion.
    it('shows an advances ribbon on an offer candidate that moves a Duo two-away to one-away', () => {
      const ernie = draftWizard(createRng(5), WIZARD_BY_ID['ernie']!)
      const onPick = vi.fn()
      render(<RecruitScreen offer={[ernie]} team={[]} teamMax={5} onPick={onPick} relics={[]} />)
      const tile = screen.getByTestId(`recruit-${ernie.wizard.id}`)
      const ribbon = screen.getByTestId('duo-ribbon')
      expect(tile.contains(ribbon)).toBe(true)
      expect(ribbon).toHaveAttribute('data-kind', 'advances')
    })

    it('does NOT pass a duoPreview to the replace-list rows (existing team members)', () => {
      const onPick = vi.fn()
      render(<RecruitScreen offer={[marcus]} team={duoTeam} teamMax={duoTeam.length} onPick={onPick} relics={[]} />)
      for (const t of duoTeam) {
        const row = screen.getByTestId(`replace-${t.wizard.id}`)
        expect(row.querySelector('[data-testid="duo-ribbon"]')).toBeNull()
      }
    })

    // Honesty on a FULL team: recruiting SWAPS OUT the weakest member, so the preview must run
    // against team-minus-replaced, not the raw team. Here theodore (a 2nd veleno holder) is
    // forced weakest ⇒ it's the default replace target. Team = [pansy(veleno), theodore(veleno,
    // weakest), draco(esecuzione)], full (teamMax=3). Offering marcus (esecuzione) would, as a
    // PURE ADDITION, light esecuzione (draco+marcus=2) alongside veleno(2) ⇒ falsely "complete"
    // cancrena. But the swap removes theodore ⇒ veleno drops to 1 ⇒ cancrena does NOT activate,
    // so no completes ribbon must be shown.
    it('does NOT falsely show a completes ribbon when the swapped-out member holds the Duo signal', () => {
      const onPick = vi.fn()
      // Force theodore to be the weakest (default replace target) with rock-bottom stats.
      const weakTheodore = { ...theodore, stats: { hp: 1, atk: 1, def: 1, spd: 1 } }
      const fullTeam = [pansy, weakTheodore, draco]
      render(<RecruitScreen offer={[marcus]} team={fullTeam} teamMax={fullTeam.length} onPick={onPick} relics={[]} />)
      const tile = screen.getByTestId(`recruit-${marcus.wizard.id}`)
      const ribbon = tile.querySelector('[data-testid="duo-ribbon"]')
      // No completes ribbon for cancrena — the swap removed the 2nd veleno holder.
      if (ribbon) expect(ribbon.getAttribute('data-kind')).not.toBe('completes')
    })
  })
})
