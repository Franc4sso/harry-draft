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

  it('mostra il tracker delle Combo Duo nel rail, come nel draft', () => {
    const onPick = vi.fn()
    const { container } = render(<RecruitScreen offer={offer} team={team} teamMax={5} onPick={onPick} relics={[]} />)
    expect(screen.getByTestId('draft-duo-tracker')).toBeInTheDocument()
    // Tutte e 6 le combo compaiono in forma compatta.
    expect(container.querySelectorAll('[data-testid="draft-duo-tracker"] [data-duo]').length).toBe(6)
  })

  it('renders candidates as WizardCard (the same card used everywhere), like the draft', () => {
    const onPick = vi.fn()
    render(<RecruitScreen offer={offer} team={team} teamMax={5} onPick={onPick} relics={[]} />)
    // Layout A ("Entra ↔ Esce") swapped the old poster-only WizardCardColumn for the
    // shared WizardCard (Task 8/9): `data-testid` now sits on the card root itself
    // (it IS the tile), not a `.wizard-col` element nested inside a wrapper div.
    for (const d of offer) {
      const tile = screen.getByTestId(`recruit-${d.wizard.id}`)
      expect(tile.getAttribute('role')).toBe('button')
    }
  })

  it('stacks the candidates in the left "entra" column (a responsive grid, like the draft)', () => {
    const onPick = vi.fn()
    render(<RecruitScreen offer={offer} team={team} teamMax={5} onPick={onPick} relics={[]} />)
    // Layout A puts recruits in their own left column (recruits | swap arrow | squad),
    // so the candidates share a `section` ancestor rather than being each other's
    // sibling directly — walk up from the card root (now the testid'd element itself)
    // to the hover wrapper div, then to that shared section.
    const tiles = offer.map(d => screen.getByTestId(`recruit-${d.wizard.id}`))
    const sections = new Set(tiles.map(t => t.closest('section')))
    expect(sections.size).toBe(1)
    const col = [...sections][0]!
    // Always 3-across: three cards side by side, not stacked, so they stay no taller
    // than the row-card squad list beside them (fits 1366×768 without a page scroll).
    expect(col.className).toContain('grid-cols-3')
  })

  it('keeps the Combo Duo panel as a "cosa cambia" band below the two columns', () => {
    const onPick = vi.fn()
    const { container } = render(
      <RecruitScreen offer={offer} team={team} teamMax={5} onPick={onPick} relics={[]} />,
    )
    // Layout A ("Entra ↔ Esce") moved the Duo tracker out of a right-hand aside rail
    // into a full-width band under the recruit/squad columns — it already tells you
    // what a swap changes (lights/advances/turns off), so it doubles as the "cosa
    // cambia" strip the layout calls for instead of a second panel.
    const tracker = container.querySelector('[data-testid="draft-duo-tracker"]')
    expect(tracker).not.toBeNull()
    expect(container.querySelector('aside')).toBeNull()
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

  describe('duo preview nel tracker (il ribbon sulla card è stato eliminato)', () => {
    // pansy + theodore are both 'veleno'-tagged (2 ⇒ the veleno signal is already lit by the
    // team alone); draco is 'esecuzione'-tagged (only 1 ⇒ esecuzione is NOT yet lit — one away).
    // Recruiting marcus (also 'esecuzione'-tagged) brings esecuzione to 2 ⇒ lit, completing the
    // 'cancrena' Duo (veleno + esecuzione).
    const pansy = draftWizard(createRng(1), WIZARD_BY_ID['pansy']!)
    const theodore = draftWizard(createRng(2), WIZARD_BY_ID['theodore']!)
    const draco = draftWizard(createRng(3), WIZARD_BY_ID['draco']!)
    const marcus = draftWizard(createRng(4), WIZARD_BY_ID['marcus']!)
    const duoTeam = [pansy, theodore, draco]

    it('selezionando la recluta che completa un Duo, il tracker marca la combo "si attiva"', async () => {
      const onPick = vi.fn()
      const { container } = render(<RecruitScreen offer={[marcus]} team={duoTeam} teamMax={5} onPick={onPick} relics={[]} />)
      // Nessun ribbon sulla card, mai.
      expect(screen.queryByTestId('duo-ribbon')).toBeNull()
      await userEvent.click(screen.getByTestId(`recruit-${marcus.wizard.id}`))
      expect(container.querySelector('[data-duo="cancrena"][data-completes]')).not.toBeNull()
    }, 15000)

    // ernie is a Tank (lights 'taunt' with just 1) AND 'scudirigen'-tagged (needs 2, so it stays
    // unlit with only 1). Against an EMPTY team (both signals two-away), recruiting ernie moves
    // the 'muro-vivente' Duo (scudirigen + taunt) from two-away to one-away — an advance, not a
    // completion.
    it('una recluta che solo AVANZA un Duo è marcata "avanza", non "si attiva"', async () => {
      const ernie = draftWizard(createRng(5), WIZARD_BY_ID['ernie']!)
      const onPick = vi.fn()
      const { container } = render(<RecruitScreen offer={[ernie]} team={[]} teamMax={5} onPick={onPick} relics={[]} />)
      await userEvent.click(screen.getByTestId(`recruit-${ernie.wizard.id}`))
      const row = container.querySelector('[data-duo="muro-vivente"]')!
      expect(row.hasAttribute('data-advances')).toBe(true)
      expect(row.hasAttribute('data-completes')).toBe(false)
    }, 15000)

    // Honesty on a FULL team: recruiting SWAPS OUT the weakest member, so the preview must run
    // against team-minus-replaced, not the raw team. Here theodore (a 2nd veleno holder) is
    // forced weakest ⇒ it's the default replace target. Team = [pansy(veleno), theodore(veleno,
    // weakest), draco(esecuzione)], full (teamMax=3). Offering marcus (esecuzione) would, as a
    // PURE ADDITION, light esecuzione (draco+marcus=2) alongside veleno(2) ⇒ falsely "complete"
    // cancrena. But the swap removes theodore ⇒ veleno drops to 1 ⇒ cancrena does NOT activate,
    // so no completes ribbon must be shown.
    it('does NOT falsely mark "si attiva" when the swapped-out member holds the Duo signal', async () => {
      const onPick = vi.fn()
      // Force theodore to be the weakest (default replace target) with rock-bottom stats.
      const weakTheodore = { ...theodore, stats: { hp: 1, atk: 1, def: 1, spd: 1 } }
      const fullTeam = [pansy, weakTheodore, draco]
      const { container } = render(<RecruitScreen offer={[marcus]} team={fullTeam} teamMax={fullTeam.length} onPick={onPick} relics={[]} />)
      await userEvent.click(screen.getByTestId(`recruit-${marcus.wizard.id}`))
      // Il tracker valuta contro baseTeam (senza theodore): cancrena NON si attiva —
      // il 2° portatore di veleno è proprio il mago che esce.
      expect(container.querySelector('[data-duo="cancrena"][data-completes]')).toBeNull()
    }, 15000)
  })
})
