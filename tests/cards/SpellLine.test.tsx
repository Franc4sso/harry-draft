import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SpellLine } from '@/components/cards/parts/SpellLine'
import { SPELL_BY_ID } from '@/data/spells'

describe('SpellLine', () => {
  it('mostra il valore, il nome e il ritmo', () => {
    render(<SpellLine spell={SPELL_BY_ID['confundo']!} />)
    expect(screen.getByTestId('spell-headline')).toHaveTextContent('−15')
    expect(screen.getByTestId('spell-headline')).toHaveTextContent('vel')
    expect(screen.getByText('Confundo')).toBeInTheDocument()
    expect(screen.getByTestId('spell-cadence')).toHaveTextContent('2')
  })

  it('la barra di precisione è larga quanto la percentuale', () => {
    render(<SpellLine spell={SPELL_BY_ID['avada']!} />)
    const bar = screen.getByTestId('spell-accuracy-bar')
    expect(bar.style.width).toBe('60%')
  })

  it('in forma compatta il verbo sparisce ma il valore resta', () => {
    render(<SpellLine spell={SPELL_BY_ID['confundo']!} compact />)
    expect(screen.getByTestId('spell-headline')).toHaveTextContent('−15')
    expect(screen.queryByTestId('spell-verb')).not.toBeInTheDocument()
  })

  it('non mostra mai il gergo di sistema', () => {
    const { container } = render(<SpellLine spell={SPELL_BY_ID['confundo']!} />)
    expect(container.textContent).not.toMatch(/permanente|cumulativo/i)
  })
})
