// tests/battle/ColpoSullaCarta.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ColpoSullaCarta } from '@/components/battle/ColpoSullaCarta'
import type { SceneEvent } from '@/lib/battleScene'

const ev = (p: Partial<SceneEvent>): SceneEvent => ({ kind: 'hit', gained: {}, lost: {}, ...p })
const box = { x: 135, y: 510, w: 212, h: 254 }

describe('ColpoSullaCarta', () => {
  it('il numero sta al CENTRO della carta, non sopra il bordo', () => {
    // Richiesta dell'utente: «il danno lo farei leggermente più piccolo e al
    // centro dell'immagine, non così sopra».
    render(<ColpoSullaCarta event={ev({ kind: 'hit', amount: 28 })} frameKey={1} box={box} />)
    const el = screen.getByTestId('colpo')
    const top = parseFloat(el.style.top)
    expect(top).toBeGreaterThan(box.y)
    expect(top).toBeLessThan(box.y + box.h)
  })

  it('mostra il danno', () => {
    render(<ColpoSullaCarta event={ev({ kind: 'hit', amount: 28 })} frameKey={1} box={box} />)
    expect(screen.getByTestId('colpo-numero')).toHaveTextContent('28')
  })

  it('il critico è più grande e dorato', () => {
    render(<ColpoSullaCarta event={ev({ kind: 'crit', amount: 74 })} frameKey={1} box={box} />)
    expect(screen.getByTestId('colpo-numero')).toHaveAttribute('data-taglia', 'crit')
  })

  it('la cura ha il +', () => {
    render(<ColpoSullaCarta event={ev({ kind: 'heal', amount: 34 })} frameKey={1} box={box} />)
    expect(screen.getByTestId('colpo-numero')).toHaveTextContent('+34')
  })

  it('assorbito: numero barrato', () => {
    render(<ColpoSullaCarta event={ev({ kind: 'block', amount: 31 })} frameKey={1} box={box} />)
    expect(screen.getByTestId('colpo-numero')).toHaveAttribute('data-assorbito', 'true')
  })

  it('schivata e turno saltato: parola, nessun numero', () => {
    const { rerender } = render(<ColpoSullaCarta event={ev({ kind: 'dodge', word: 'SCHIVA' })} frameKey={1} box={box} />)
    expect(screen.queryByTestId('colpo-numero')).toBeNull()
    rerender(<ColpoSullaCarta event={ev({ kind: 'skip', word: 'SALTA' })} frameKey={2} box={box} />)
    expect(screen.queryByTestId('colpo-numero')).toBeNull()
    expect(screen.getByTestId('colpo')).toHaveTextContent('SALTA')
  })

  it('su una carta di bordo il numero resta dentro la cornice', () => {
    // Misurato sul mockup: senza vincolo il K.O. usciva a sinistra.
    render(<ColpoSullaCarta event={ev({ kind: 'kill', word: 'K.O.' })} frameKey={1}
      box={{ x: 0, y: 510, w: 212, h: 254 }} />)
    expect(parseFloat(screen.getByTestId('colpo').style.left)).toBeGreaterThanOrEqual(80)
  })

  it('senza box non rende nulla', () => {
    const { container } = render(<ColpoSullaCarta event={ev({ kind: 'hit', amount: 5 })} frameKey={1} box={null} />)
    expect(container).toBeEmptyDOMElement()
  })
})
