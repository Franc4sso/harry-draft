import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ArchetypeTracker } from '@/components/draft/ArchetypeTracker'

const mage = (id: string, tags: string[] = []) =>
  ({ wizard: { id, name: id, house: 'Serpeverde', role: 'Attaccante', tags }, level: 1 }) as any

describe('ArchetypeTracker (Costellazioni)', () => {
  it('mostra i 4 archetipi con sistema (Veleno/Carnefice/Muro/Magie Oscure)', () => {
    const { container } = render(<ArchetypeTracker picks={[]} />)
    expect(container.querySelector('[data-arch="tossicita"]')).not.toBeNull()
    expect(container.querySelector('[data-arch="spietatezza"]')).not.toBeNull()
    expect(container.querySelector('[data-arch="bastione"]')).not.toBeNull()
    // magieOscure ora ha la sua riga Costellazione (sopita con picks=[])
    expect(container.querySelector('[data-arch="oscurita"]')).not.toBeNull()
    expect(screen.getByText(/Magie Oscure/i)).not.toBeNull()
  })
  it('mostra 2/3 e "vicino" con 2 maghi veleno', () => {
    const picks = [mage('a', ['veleno']), mage('b', ['veleno'])]
    const { container } = render(<ArchetypeTracker picks={picks} />)
    const row = container.querySelector('[data-arch="tossicita"]')!
    expect(row).toHaveAttribute('data-state', 'near')
    expect(row).toHaveTextContent('2/3')
  })
  it('mostra "attivo" + effetto con 3 maghi scudirigen', () => {
    const picks = [mage('a', ['scudirigen']), mage('b', ['scudirigen']), mage('c', ['scudirigen'])]
    const { container } = render(<ArchetypeTracker picks={picks} />)
    const row = container.querySelector('[data-arch="bastione"]')!
    expect(row).toHaveAttribute('data-state', 'active')
    expect(row).toHaveTextContent(/riflette|riman/i)
  })
  it('mostra "attivo" + effetto con 3 maghi magieOscure', () => {
    const picks = [mage('a', ['magieOscure']), mage('b', ['magieOscure']), mage('c', ['magieOscure'])]
    const { container } = render(<ArchetypeTracker picks={picks} />)
    const row = container.querySelector('[data-arch="oscurita"]')!
    expect(row).toHaveAttribute('data-state', 'active')
    expect(row).toHaveTextContent(/patto oscuro/i)
  })
})
