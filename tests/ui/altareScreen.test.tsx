import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AltareScreen } from '@/components/screens/AltareScreen'
import { RELIC_BY_ID } from '@/data/relics'
import type { DraftedWizard, Relic } from '@/types'

const wizardCost: Relic = RELIC_BY_ID['diario-riddle']! // sacrificeCost: { kind: 'wizard' }
const relicCost: Relic = RELIC_BY_ID['mano-della-gloria']! // sacrificeCost: { kind: 'relic' }
const maxHpCost: Relic = RELIC_BY_ID['calice-avvelenato']! // sacrificeCost: { kind: 'maxHp', amount: 40 }

function makeTeam(): DraftedWizard[] {
  return [
    { wizard: { id: 'a', name: 'Ada', house: 'Grifondoro', role: 'Tank', tags: [] }, level: 1, stats: { hp: 100, atk: 10, def: 10, spd: 10 }, maxHp: 100 },
    { wizard: { id: 'b', name: 'Beo', house: 'Grifondoro', role: 'Attaccante', tags: [] }, level: 1, stats: { hp: 90, atk: 20, def: 5, spd: 12 }, maxHp: 90 },
  ] as any
}

describe('AltareScreen', () => {
  it('renders data-testid altare-screen', () => {
    render(<AltareScreen offers={[wizardCost]} team={makeTeam()} owned={[]} onBuy={vi.fn()} onSkip={vi.fn()} />)
    expect(screen.getByTestId('altare-screen')).not.toBeNull()
  })

  it('mostra POTERE e COSTO per ogni offerta prima della conferma', () => {
    render(<AltareScreen offers={[wizardCost, relicCost, maxHpCost]} team={makeTeam()} owned={[]} onBuy={vi.fn()} onSkip={vi.fn()} />)
    for (const relic of [wizardCost, relicCost, maxHpCost]) {
      expect(screen.getByTestId(`altare-power-${relic.id}`)).not.toBeNull()
      expect(screen.getByTestId(`altare-cost-${relic.id}`)).not.toBeNull()
    }
  })

  it('bottone "Vai via" e\' sempre presente e chiama onSkip', () => {
    const onSkip = vi.fn()
    render(<AltareScreen offers={[wizardCost]} team={makeTeam()} owned={[]} onBuy={vi.fn()} onSkip={onSkip} />)
    fireEvent.click(screen.getByText('Vai via'))
    expect(onSkip).toHaveBeenCalledTimes(1)
  })

  it('costo wizard: mostra un picker mago e chiama onBuy con costWizardId', () => {
    const onBuy = vi.fn()
    const team = makeTeam()
    render(<AltareScreen offers={[wizardCost]} team={team} owned={[]} onBuy={onBuy} onSkip={vi.fn()} />)
    fireEvent.click(screen.getByTestId(`altare-offer-${wizardCost.id}`))
    fireEvent.click(screen.getByTestId(`altare-pick-wizard-${team[0]!.wizard.id}`))
    fireEvent.click(screen.getByTestId(`altare-confirm-${wizardCost.id}`))
    expect(onBuy).toHaveBeenCalledWith(wizardCost.id, { costWizardId: team[0]!.wizard.id })
  })

  it('costo relic: mostra un picker reliquia e chiama onBuy con costRelicId', () => {
    const onBuy = vi.fn()
    const owned = [{ relic: { id: 'owned-1', name: 'Amuleto', desc: '', rarity: 'comune' as const }, stageObtained: 0 }]
    render(<AltareScreen offers={[relicCost]} team={makeTeam()} owned={owned} onBuy={onBuy} onSkip={vi.fn()} />)
    fireEvent.click(screen.getByTestId(`altare-offer-${relicCost.id}`))
    fireEvent.click(screen.getByTestId('altare-pick-relic-owned-1'))
    fireEvent.click(screen.getByTestId(`altare-confirm-${relicCost.id}`))
    expect(onBuy).toHaveBeenCalledWith(relicCost.id, { costRelicId: 'owned-1' })
  })

  it('costo maxHp: mostra un picker mago e chiama onBuy con costWizardId', () => {
    const onBuy = vi.fn()
    const team = makeTeam()
    render(<AltareScreen offers={[maxHpCost]} team={team} owned={[]} onBuy={onBuy} onSkip={vi.fn()} />)
    fireEvent.click(screen.getByTestId(`altare-offer-${maxHpCost.id}`))
    fireEvent.click(screen.getByTestId(`altare-pick-wizard-${team[1]!.wizard.id}`))
    fireEvent.click(screen.getByTestId(`altare-confirm-${maxHpCost.id}`))
    expect(onBuy).toHaveBeenCalledWith(maxHpCost.id, { costWizardId: team[1]!.wizard.id })
  })

  it('offerta non pagabile e\' disabilitata con un motivo visibile (costo relic senza reliquie possedute)', () => {
    render(<AltareScreen offers={[relicCost]} team={makeTeam()} owned={[]} onBuy={vi.fn()} onSkip={vi.fn()} />)
    const offer = screen.getByTestId(`altare-offer-${relicCost.id}`)
    expect(offer.getAttribute('aria-disabled')).toBe('true')
    expect(screen.getByTestId(`altare-reason-${relicCost.id}`)).not.toBeNull()
  })

  it('offerta non pagabile per wizard (squadra con un solo mago) e\' disabilitata', () => {
    const soloTeam = [makeTeam()[0]!]
    render(<AltareScreen offers={[wizardCost]} team={soloTeam} owned={[]} onBuy={vi.fn()} onSkip={vi.fn()} />)
    const offer = screen.getByTestId(`altare-offer-${wizardCost.id}`)
    expect(offer.getAttribute('aria-disabled')).toBe('true')
  })
})
