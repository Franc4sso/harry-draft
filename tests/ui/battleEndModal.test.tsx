import { it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BattleEndModal } from '@/components/battle/BattleEndModal'

it('renders the win outcome and confirms', () => {
  const onConfirm = vi.fn()
  render(<BattleEndModal outcome="win" onConfirm={onConfirm} />)
  expect(screen.getByTestId('battle-end-modal').getAttribute('role')).toBe('dialog')
  expect(screen.getByText('Vittoria')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /Continua/i }))
  expect(onConfirm).toHaveBeenCalledOnce()
})

it('renders the loss outcome with the right button', () => {
  render(<BattleEndModal outcome="loss" onConfirm={() => {}} />)
  expect(screen.getByText('Sconfitta')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Vedi esito/i })).toBeInTheDocument()
})
