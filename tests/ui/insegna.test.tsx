import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Insegna } from '@/components/ui/Insegna'
import { FoilText, DrawDivider } from '@/components/ui/motion'

describe('Insegna + foil primitives', () => {
  it('renders kicker + accessible title heading', () => {
    render(<Insegna kicker="Sala" title="Reclutamento" />)
    expect(screen.getByText('Sala')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Reclutamento' })).toBeTruthy()
  })
  it('FoilText exposes its text; DrawDivider is decorative', () => {
    const { container } = render(<><FoilText>Ciao</FoilText><DrawDivider /></>)
    expect(screen.getByText('Ciao')).toBeTruthy()
    expect(container.querySelector('[aria-hidden="true"]')).toBeTruthy()
  })
})
