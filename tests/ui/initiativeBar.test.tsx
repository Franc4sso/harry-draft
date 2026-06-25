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
