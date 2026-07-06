import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { UnitBust } from '@/components/battle/UnitBust'
import type { ReplayUnit } from '@/game/engine/combat/replay'
import type { ActiveEffect } from '@/types'

const unit = {
  key: 'left:x', id: 'x', name: 'X', side: 'left', house: 'Grifondoro', role: 'Attaccante', tier: 3,
  maxHp: 100, atk: 40, def: 20, spd: 30, baseAtk: 40, baseDef: 20, baseSpd: 30,
  spell: { id: 's', name: 'Incantesimo', cooldown: 0 },
} as unknown as ReplayUnit

// Veleno is permanent (remaining never decrements, stays at defaultDuration 2) and
// accumulates DOSES in `stacks` (1..8). The pill must show the DOSE COUNT, not the
// frozen `remaining` — otherwise the number never changes as poison builds up.
describe('veleno pill shows accumulated doses (stacks), not remaining', () => {
  it('renders the stack count for a multi-dose veleno', () => {
    const eff = { kind: 'dot', statusId: 'veleno', remaining: 2, stacks: 5, amount: 4 } as unknown as ActiveEffect
    const { container } = render(<UnitBust unit={unit} hp={100} effects={[eff]} />)
    const pill = container.querySelector('[data-status-kind="dot"]')
    expect(pill).not.toBeNull()
    // Shows the 5 doses, NOT remaining (2).
    expect(pill!.textContent).toContain('5')
    expect(pill!.textContent).not.toContain('2')
  })

  it('shows the growing dose count as poison stacks up', () => {
    const at3 = { kind: 'dot', statusId: 'veleno', remaining: 2, stacks: 3, amount: 4 } as unknown as ActiveEffect
    const { container } = render(<UnitBust unit={unit} hp={100} effects={[at3]} />)
    expect(container.querySelector('[data-status-kind="dot"]')!.textContent).toContain('3')
  })

  it('tooltip names the dose count', () => {
    const eff = { kind: 'dot', statusId: 'veleno', remaining: 2, stacks: 5, amount: 4 } as unknown as ActiveEffect
    const { container } = render(<UnitBust unit={unit} hp={100} effects={[eff]} />)
    const pill = container.querySelector('[data-status-kind="dot"]')
    expect(pill!.getAttribute('title')).toMatch(/×5|x5|5 dos/i)
  })

  // The bug the player actually sees: a FIRST dose (stacks: 1). It must read "1" (one dose),
  // never "2" (the frozen permanent `remaining`) — otherwise the very first poison looks like
  // some 2-turn status and the count doesn't visibly start at 1 and climb.
  it('a single-dose veleno shows 1, not the frozen remaining (2)', () => {
    // No `amount` on purpose: veleno's per-tick damage lives on the status def (tickDamage),
    // not on the effect instance — this mirrors what the real engine pushes.
    const eff = { kind: 'dot', statusId: 'veleno', remaining: 2, stacks: 1 } as unknown as ActiveEffect
    const { container } = render(<UnitBust unit={unit} hp={100} effects={[eff]} />)
    const pill = container.querySelector('[data-status-kind="dot"]')
    expect(pill).not.toBeNull()
    expect(pill!.textContent).toContain('1')
    expect(pill!.textContent).not.toContain('2')
  })

  it('tooltip shows the real per-tick damage (from the status def), not -0', () => {
    // Engine-shaped veleno effect: no `amount`. The tooltip must still state a non-zero
    // per-turn damage (veleno tickDamage is 4/stack) rather than "-0 HP/turno".
    const eff = { kind: 'dot', statusId: 'veleno', remaining: 2, stacks: 1 } as unknown as ActiveEffect
    const { container } = render(<UnitBust unit={unit} hp={100} effects={[eff]} />)
    const title = container.querySelector('[data-status-kind="dot"]')!.getAttribute('title') ?? ''
    expect(title).not.toMatch(/-0 HP/)
    expect(title).toMatch(/HP\/turno/)
  })
})
