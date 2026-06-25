import { it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusLegend } from '@/components/battle/StatusLegend'

it('lists control statuses with an effect blurb', () => {
  render(<StatusLegend defaultOpen />)
  expect(screen.getByTestId('status-legend')).toBeInTheDocument()
  expect(screen.getByText(/Stordito/)).toBeInTheDocument()
  expect(screen.getByText(/Congelamento/)).toBeInTheDocument()
})
