import { it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { InitiativeBar } from '@/components/battle/InitiativeBar'
import type { Replay } from '@/game/engine/combat/replay'

const replay = {
  units: [
    { key: 'left:a', id: 'a', name: 'Aaa', side: 'left', house: 'Grifondoro', role: 'Tank', tier: 3, maxHp: 100, atk: 10, def: 10, spd: 30, baseAtk: 10, baseDef: 10, baseSpd: 30, spell: { id: 's', name: 'S', cooldown: 0 } },
    { key: 'right:b', id: 'b', name: 'Bbb', side: 'right', house: 'Serpeverde', role: 'Attaccante', tier: 3, maxHp: 100, atk: 10, def: 10, spd: 20, baseAtk: 10, baseDef: 10, baseSpd: 20, spell: { id: 's', name: 'S', cooldown: 0 } },
  ],
  frames: [{ index: 0, entry: null, hp: { 'left:a': 100, 'right:b': 100 }, cooldowns: {}, statusEffects: {} }],
} as unknown as Replay

it('uses full width and does not clip horizontally', () => {
  const { container } = render(<InitiativeBar replay={replay} index={0} />)
  const bar = container.querySelector('[data-testid="initiative-bar"]') as HTMLElement
  expect(bar.className).toContain('w-full')
  expect(bar.className).not.toContain('overflow-x')
})

it('marks each slot with its side (mine vs enemy)', () => {
  const { container } = render(<InitiativeBar replay={replay} index={0} />)
  expect(container.querySelector('[data-side="left"]')).toBeTruthy()
  expect(container.querySelector('[data-side="right"]')).toBeTruthy()
})

it('renders a face image per unit', () => {
  const { container } = render(<InitiativeBar replay={replay} index={0} />)
  // PortraitImage renders an <img data-variant="bust"> (jsdom won't fire onError, so the img stays).
  expect(container.querySelectorAll('img[data-variant="bust"]').length).toBeGreaterThanOrEqual(2)
})

it('does not render the unit name in the rail', () => {
  render(<InitiativeBar replay={replay} index={0} />)
  // The fixture units are named 'Aaa' / 'Bbb' — they must NOT appear as text now.
  expect(screen.queryByText('Aaa')).toBeNull()
  expect(screen.queryByText('Bbb')).toBeNull()
})

it('orders equal-speed units by the engine tiebreak (wizard id), not array order', () => {
  // Two same-speed allies; array order is [zzz, aaa] but the engine acts id-ascending,
  // so the rail must show aaa before zzz (regression: it used raw array index → wrong order).
  const tie = {
    units: [
      { key: 'left:zzz', id: 'zzz', name: 'Zzz', side: 'left', house: 'Grifondoro', role: 'Tank', tier: 3, maxHp: 100, atk: 10, def: 10, spd: 25, baseAtk: 10, baseDef: 10, baseSpd: 25, spell: { id: 's', name: 'S', cooldown: 0 } },
      { key: 'left:aaa', id: 'aaa', name: 'Aaa', side: 'left', house: 'Serpeverde', role: 'Tank', tier: 3, maxHp: 100, atk: 10, def: 10, spd: 25, baseAtk: 10, baseDef: 10, baseSpd: 25, spell: { id: 's', name: 'S', cooldown: 0 } },
    ],
    frames: [{ index: 0, entry: null, hp: { 'left:zzz': 100, 'left:aaa': 100 }, cooldowns: {}, statusEffects: {} }],
  } as unknown as Replay
  const { container } = render(<InitiativeBar replay={tie} index={0} />)
  const srcs = [...container.querySelectorAll('img[data-variant="bust"]')].map(i => i.getAttribute('src'))
  expect(srcs[0]).toContain('/portraits/aaa.webp')
  expect(srcs[1]).toContain('/portraits/zzz.webp')
})

it('lays each slot as a vertical stack (fits the narrow column, no clip)', () => {
  const { container } = render(<InitiativeBar replay={replay} index={0} />)
  const slot = container.querySelector('[data-side]') as HTMLElement
  // Vertical stack: the slot uses flex-col so face + spd line stack, keeping width within the column.
  expect(slot.className).toMatch(/flex-col/)
})
