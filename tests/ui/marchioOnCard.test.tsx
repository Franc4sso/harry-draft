import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { WizardCardColumn } from '@/components/cards/WizardCardColumn'
import { WizardCardRow } from '@/components/cards/WizardCardRow'
import { DuoSignalMarks } from '@/components/cards/DuoSignalMarks'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARD_BY_ID } from '@/data/wizards'
import { tagsOf } from '@/game/engine/roster'
import { wizardDuoSignals } from '@/game/engine/duos'
import type { DraftedWizard } from '@/types'

// mcgonagall: Tank, tags=['order'] → nessun archetipo nativo, così il Marchio è l'unico segnale-tag.
const tankSenzaArchetipo = () => draftWizard(createRng(1), WIZARD_BY_ID['mcgonagall']!)
// cedric: Attaccante, tags=['scudirigen'] → ha GIÀ un archetipo nativo: il caso in cui il nastro
// (che ne mostra uno solo) da solo nasconderebbe il Marchio.
const conArchetipoNativo = () => draftWizard(createRng(1), WIZARD_BY_ID['cedric']!)

const marchiato = (d: DraftedWizard, tag: string): DraftedWizard => ({ ...d, grantedTags: [tag] })

describe('§3b — il Marchio si vede sulla card del mago che l’ha ricevuto', () => {
  it('un mago senza archetipo nativo mostra il nastro archetipo del tag CONCESSO', () => {
    const d = marchiato(tankSenzaArchetipo(), 'veleno')
    expect(tagsOf(d)).toContain('veleno')
    render(<WizardCardColumn drafted={d} />)
    const ribbon = screen.getByTestId('archetype-ribbon')
    expect(ribbon).toHaveAttribute('data-archetype', 'veleno')
  })

  it('senza Marchio la card non inventa nastri (comportamento invariato)', () => {
    render(<WizardCardColumn drafted={tankSenzaArchetipo()} />)
    expect(screen.queryByTestId('archetype-ribbon')).not.toBeInTheDocument()
    expect(screen.queryByTestId('marchio-marks')).not.toBeInTheDocument()
  })

  it('un mago con archetipo nativo mostra COMUNQUE il Marchio, in una pill dedicata', () => {
    const d = marchiato(conArchetipoNativo(), 'veleno') // nativo: scudirigen (Muro)
    render(<WizardCardColumn drafted={d} />)
    // Il nastro resta sull'archetipo nativo (il primo tag): senza la pill, il veleno sparirebbe.
    expect(screen.getByTestId('archetype-ribbon')).toHaveAttribute('data-archetype', 'scudirigen')
    const badge = screen.getByTestId('marchio-badge')
    expect(badge).toHaveAttribute('data-tag', 'veleno')
    expect(badge.textContent).toMatch(/marchio/i)
  })

  it('vale anche sulla card orizzontale del roster', () => {
    render(<WizardCardRow drafted={marchiato(conArchetipoNativo(), 'magieOscure')} />)
    expect(screen.getByTestId('marchio-badge')).toHaveAttribute('data-tag', 'magieOscure')
  })

  it('wizardDuoSignals con i tag effettivi vede il segnale concesso (motore e UI non divergono)', () => {
    const d = marchiato(tankSenzaArchetipo(), 'veleno')
    expect(wizardDuoSignals(d.wizard)).not.toContain('veleno')          // solo nativi: cieco
    expect(wizardDuoSignals(d.wizard, tagsOf(d))).toContain('veleno')   // tag effettivi: lo vede
  })

  it('DuoSignalMarks mostra il segnale concesso quando riceve i tag effettivi', () => {
    const d = marchiato(tankSenzaArchetipo(), 'veleno')
    render(<DuoSignalMarks wizard={d.wizard} tags={tagsOf(d)} />)
    const marks = screen.getByTestId('duo-signal-marks')
    expect(within(marks).getByText('Veleno')).toBeInTheDocument()
  })
})
