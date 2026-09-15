import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Tooltip } from '@/components/ui/Tooltip'

const setup = () =>
  render(<Tooltip label="prova" content={<span>CONTENUTO</span>}><span>trigger</span></Tooltip>)

describe('Tooltip — apertura', () => {
  // Regressione (2026-09-15): il click faceva un toggle cieco. Su desktop
  // `onMouseEnter` aveva gia' aperto il popover, quindi il click lo RICHIUDEVA
  // e cliccare un tooltip sembrava non fare nulla. Il difetto colpiva ruolo,
  // archetipo e il sigillo dell'abilita' sulla carta.
  it('il click col mouse lascia aperto (l-hover ha gia aperto)', async () => {
    setup()
    await userEvent.click(screen.getByRole('button'))
    expect(screen.getByText('CONTENUTO')).toBeInTheDocument()
  })

  it('il passaggio del mouse apre e l-uscita chiude', () => {
    setup()
    const btn = screen.getByRole('button')
    fireEvent.mouseEnter(btn)
    expect(screen.getByText('CONTENUTO')).toBeInTheDocument()
    fireEvent.mouseLeave(btn)
    expect(screen.queryByText('CONTENUTO')).not.toBeInTheDocument()
  })

  it('col dito il tocco apre e il ritocco chiude', () => {
    setup()
    const btn = screen.getByRole('button')
    // detail 0 = click sintetico (tocco o tastiera): nessun hover lo ha preceduto.
    fireEvent.click(btn, { detail: 0 })
    expect(screen.getByText('CONTENUTO')).toBeInTheDocument()
    fireEvent.click(btn, { detail: 0 })
    expect(screen.queryByText('CONTENUTO')).not.toBeInTheDocument()
  })
})
