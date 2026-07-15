import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { ShopScreen } from '@/components/screens/ShopScreen'
import type { ShopStock } from '@/game/engine/resolvers/shop'
import type { DraftedWizard } from '@/types'

const darkRelic = {
  id: 'marchio-nero', name: 'Marchio Nero', desc: 'oscuro', rarity: 'rara',
  keywords: ['magieOscure'], assignable: true, grantsDarkMagic: { bonus: 0.5, recoil: 0.2 },
} as never
const plainRelic = { id: 'giratempo', name: 'Giratempo', desc: '+12 Velocità', rarity: 'comune', assignable: true } as never

const stock: ShopStock = {
  slots: [
    { id: 'relic-dark', kind: 'relic', price: 25, relic: darkRelic },
    { id: 'relic-plain', kind: 'relic', price: 20, relic: plainRelic },
  ],
  rerollPrice: 15,
}
const team = [
  { wizard: { id: 'harry', name: 'Harry', house: 'Grifondoro', role: 'Attaccante' }, stats: { hp: 1, atk: 1, def: 1, spd: 1 }, maxHp: 1, spell: { id: 's', name: 'S', type: 'Attacco', hitChance: 1 } },
] as unknown as DraftedWizard[]

describe('ShopScreen corruption warning', () => {
  it('picking a carrier for a grantsDarkMagic relic shows the corruption warning before buying', () => {
    render(<ShopScreen stock={stock} bought={[]} cioccorane={100} team={team} onBuy={() => {}} onReroll={() => {}} onLeave={() => {}} />)
    const slot = screen.getByTestId('shop-slot-relic-dark')
    fireEvent.click(within(slot).getByText('Harry'))
    expect(within(slot).getByText(/Diventerà Corrotto/i)).toBeInTheDocument()
    expect(within(slot).getByText(/per sempre, non curabile/i)).toBeInTheDocument()
  })

  it('a normal (non-corrupting) assignable relic carrier pick does not show the corruption warning', () => {
    render(<ShopScreen stock={stock} bought={[]} cioccorane={100} team={team} onBuy={() => {}} onReroll={() => {}} onLeave={() => {}} />)
    const slot = screen.getByTestId('shop-slot-relic-plain')
    fireEvent.click(within(slot).getByText('Harry'))
    expect(within(slot).queryByText(/Diventerà Corrotto/i)).toBeNull()
  })
})
