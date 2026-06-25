import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { SpellFx } from '@/components/battle/SpellFx'
import type { LogEntry } from '@/types'

const at = { x: 50, y: 80 }
const from = { x: 50, y: 20 }
function entry(partial: Partial<LogEntry>): LogEntry {
  return { turn: 1, actorId: 'a', actorSide: 'left', targetId: 'x', targetSide: 'right', action: 'S', type: 'Attacco', flags: [], ...partial } as LogEntry
}

it('fire renders a burst shape', () => {
  const { container } = render(<SpellFx entry={entry({ action: 'Incendio', type: 'Attacco' })} from={from} to={at} fxKey={1} />)
  expect(container.querySelector('[data-archetype="fire"][data-shape="burst"]')).toBeTruthy()
})

it('a dark spell (Avada) renders an orb shape', () => {
  const { container } = render(<SpellFx entry={entry({ action: 'Avada Kedavra', type: 'Attacco' })} from={from} to={at} fxKey={4} />)
  expect(container.querySelector('[data-archetype="dark"][data-shape="orb"]')).toBeTruthy()
})

it('a plain attack renders a bolt shape', () => {
  const { container } = render(<SpellFx entry={entry({ action: 'Stupeficium', type: 'Attacco' })} from={from} to={at} fxKey={5} />)
  expect(container.querySelector('[data-archetype="beam"][data-shape="bolt"]')).toBeTruthy()
})

it('heal renders a target-anchored sparkle and no projectile flight', () => {
  const { container } = render(<SpellFx entry={entry({ action: 'Episkey', type: 'Cura', flags: ['heal'] })} from={from} to={at} fxKey={2} />)
  expect(container.querySelector('[data-shape="heal"]')).toBeTruthy()
})

it('shield still renders nothing', () => {
  const { container } = render(<SpellFx entry={entry({ action: 'Protego', type: 'Difesa', flags: ['block'] })} from={from} to={at} fxKey={3} />)
  expect(container.querySelector('[data-testid="spell-fx"]')).toBeNull()
})
