import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { ShopScreen } from '@/components/screens/ShopScreen'
import type { ShopStock } from '@/game/engine/resolvers/shop'
import type { DraftedWizard } from '@/types'

const relic = { id: 'giratempo', name: 'Giratempo', desc: '+12 Velocità', rarity: 'comune' } as never
const stock: ShopStock = {
  slots: [
    { id: 'relic-0', kind: 'relic', price: 25, relic },
    { id: 'heal', kind: 'heal', price: 35 },
    { id: 'removeWizard', kind: 'removeWizard', price: 20 },
  ],
  rerollPrice: 15,
}
const team = [{ wizard: { id: 'harry', name: 'Harry', house: 'Grifondoro', role: 'Attaccante' }, stats: { hp: 1, atk: 1, def: 1, spd: 1 }, maxHp: 1, spell: { id: 's', name: 'S', type: 'Attacco', hitChance: 1 } }] as unknown as DraftedWizard[]

describe('ShopScreen', () => {
  it('shows prices, greys sold slots, and buys an affordable relic', () => {
    const onBuy = vi.fn()
    render(<ShopScreen stock={stock} bought={['heal']} cioccorane={100} team={team} onBuy={onBuy} onReroll={() => {}} onLeave={() => {}} />)
    expect(screen.getByText('Giratempo')).toBeInTheDocument()
    // heal is sold → its buy control is disabled
    expect(screen.getByTestId('shop-slot-heal').querySelector('button')).toBeDisabled()
    fireEvent.click(within(screen.getByTestId('shop-slot-relic-0')).getByRole('button'))
    expect(onBuy.mock.calls[0]?.[0]).toBe('relic-0') // second arg is undefined for a non-assignable relic
  })
  it('disables a slot the player cannot afford', () => {
    render(<ShopScreen stock={stock} bought={[]} cioccorane={10} team={team} onBuy={() => {}} onReroll={() => {}} onLeave={() => {}} />)
    expect(within(screen.getByTestId('shop-slot-relic-0')).getByRole('button')).toBeDisabled()
  })
  it('leave calls onLeave', () => {
    const onLeave = vi.fn()
    render(<ShopScreen stock={stock} bought={[]} cioccorane={100} team={team} onBuy={() => {}} onReroll={() => {}} onLeave={onLeave} />)
    fireEvent.click(screen.getByRole('button', { name: /Esci/i }))
    expect(onLeave).toHaveBeenCalled()
  })
})
