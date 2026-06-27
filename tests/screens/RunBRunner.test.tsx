import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RunBRunner } from '@/components/screens/RunBRunner'
import { clearRun } from '@/lib/runStore'

beforeEach(() => { try { clearRun() } catch {} ; localStorage.clear() })

describe('RunBRunner', () => {
  it('drives house → starter → map', async () => {
    render(<RunBRunner seed="seed-runner" />)
    expect(screen.getByText(/Scegli la tua Casa/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Grifondoro/ }))
    expect(screen.getByText(/Scegli 2 maghi/)).toBeInTheDocument()
    // pick first two offered cards
    const picks = screen.getAllByTestId(/^pick-/)
    await userEvent.click(picks[0]!)
    await userEvent.click(picks[1]!)
    await userEvent.click(screen.getByRole('button', { name: /Inizia/ }))
    expect(screen.getByText(/Scegli il tuo cammino/)).toBeInTheDocument()
  })
})
