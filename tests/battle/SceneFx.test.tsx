import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SceneFx } from '@/components/battle/SceneFx'
import type { SceneEvent } from '@/lib/battleScene'

const ev = (p: Partial<SceneEvent>): SceneEvent => ({ kind: 'hit', gained: {}, lost: {}, ...p })

describe('SceneFx', () => {
  it('un colpo mostra il danno', () => {
    render(<SceneFx event={ev({ kind: 'hit', amount: 28 })} frameKey={1} />)
    expect(screen.getByTestId('fx-number')).toHaveTextContent('28')
  })

  it('il critico mostra la parola e un numero piu grande', () => {
    render(<SceneFx event={ev({ kind: 'crit', amount: 74, word: 'CRITICO' })} frameKey={1} />)
    expect(screen.getByTestId('fx-word')).toHaveTextContent('CRITICO')
    expect(screen.getByTestId('fx-number')).toHaveAttribute('data-size', 'big')
  })

  it('il turno saltato mostra SALTA e nessun numero', () => {
    render(<SceneFx event={ev({ kind: 'skip', word: 'SALTA' })} frameKey={1} />)
    expect(screen.getByTestId('fx-word')).toHaveTextContent('SALTA')
    expect(screen.queryByTestId('fx-number')).not.toBeInTheDocument()
  })

  it('la schivata non mostra numeri', () => {
    render(<SceneFx event={ev({ kind: 'dodge', word: 'SCHIVA' })} frameKey={1} />)
    expect(screen.queryByTestId('fx-number')).not.toBeInTheDocument()
  })

  it('lo scudo mostra il numero BARRATO', () => {
    render(<SceneFx event={ev({ kind: 'block', amount: 31 })} frameKey={1} />)
    expect(screen.getByTestId('fx-number')).toHaveAttribute('data-blocked', 'true')
  })

  it('la cura mostra un numero positivo', () => {
    render(<SceneFx event={ev({ kind: 'heal', amount: 28 })} frameKey={1} />)
    expect(screen.getByTestId('fx-number')).toHaveTextContent('+28')
  })

  it('i Duo mostrano il loro nome', () => {
    render(<SceneFx event={ev({ kind: 'duo-miasma', word: 'MIASMA' })} frameKey={1} />)
    expect(screen.getByTestId('fx-word')).toHaveTextContent('MIASMA')
  })

  it('un frame senza scena non rende nulla', () => {
    const { container } = render(<SceneFx event={ev({ kind: 'none' })} frameKey={1} />)
    expect(container).toBeEmptyDOMElement()
  })
})
