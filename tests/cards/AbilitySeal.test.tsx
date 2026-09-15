import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AbilitySeal } from '@/components/cards/parts/AbilitySeal'

describe('AbilitySeal', () => {
  it('un mago senza firma non mostra nulla', () => {
    const { container } = render(<AbilitySeal wizardId="goyle" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('un mago con firma mostra il sigillo', () => {
    render(<AbilitySeal wizardId="voldemort" />)
    expect(screen.getByTestId('ability-seal')).toBeInTheDocument()
  })

  it('il testo compare solo dopo interazione', () => {
    // Tooltip apre anche su `onMouseEnter`: con `userEvent.click` (che simula
    // hover→down→up→click) l'hover apre il popover PRIMA che il click lo
    // richiuda col toggle, quindi il testo non compare mai — non è un bug di
    // questo componente, è come si comporta Tooltip sotto un click sintetico
    // che passa dall'hover. `fireEvent.click` invia solo il click, com'è il
    // tocco reale su mobile (dove non esiste hover): apre in un colpo solo.
    render(<AbilitySeal wizardId="voldemort" />)
    expect(screen.queryByText('Terrore Immortale')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('ability-seal'))
    expect(screen.getByText('Terrore Immortale')).toBeInTheDocument()
    expect(screen.getByText('+50%')).toBeInTheDocument()
  })
})
