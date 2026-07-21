import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RelicSwapPanel } from '@/components/relics/RelicSwapPanel'
import type { ActiveRelic, Relic } from '@/types'

const incoming: Relic = { id: 'nuova', name: 'Reliquia Nuova', desc: 'x', rarity: 'rara' }
const owned: ActiveRelic[] = ['a', 'b', 'c', 'd', 'e'].map((id, i) =>
  ({ relic: { id, name: `Reliquia ${id}`, desc: 'y', rarity: 'comune' }, stageObtained: i }))

describe('RelicSwapPanel', () => {
  it('renders one pastiglia per owned relic plus a reject button', () => {
    render(<RelicSwapPanel incoming={incoming} owned={owned} onSwap={() => {}} onReject={() => {}} />)
    for (const a of owned) expect(screen.getByTestId(`swap-${a.relic.id}`)).toBeInTheDocument()
    expect(screen.getByTestId('relic-reject')).toBeInTheDocument()
  })

  it('clicking an owned pastiglia calls onSwap with its id', () => {
    const onSwap = vi.fn()
    render(<RelicSwapPanel incoming={incoming} owned={owned} onSwap={onSwap} onReject={() => {}} />)
    fireEvent.click(screen.getByTestId('swap-c'))
    expect(onSwap).toHaveBeenCalledWith('c')
  })

  it('clicking Rifiuta calls onReject', () => {
    const onReject = vi.fn()
    render(<RelicSwapPanel incoming={incoming} owned={owned} onSwap={() => {}} onReject={onReject} />)
    fireEvent.click(screen.getByTestId('relic-reject'))
    expect(onReject).toHaveBeenCalled()
  })

  it('shows the incoming relic name', () => {
    render(<RelicSwapPanel incoming={incoming} owned={owned} onSwap={() => {}} onReject={() => {}} />)
    expect(screen.getByText((_, node) => node?.textContent === `Collezione piena — scarta una reliquia per prendere ${incoming.name}`)).toBeInTheDocument()
  })
})
