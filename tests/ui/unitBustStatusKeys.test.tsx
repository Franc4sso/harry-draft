import { describe, it, expect, vi, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import { UnitBust } from '@/components/battle/UnitBust'
import type { ReplayUnit } from '@/game/engine/combat/replay'
import type { ActiveEffect } from '@/types'

const base: ReplayUnit = {
  key: 'left:harry', side: 'left', id: 'harry', name: 'Harry Potter',
  house: 'Grifondoro', role: 'Attaccante', tier: 1, maxHp: 100,
  atk: 50, def: 40, spd: 30,
  baseAtk: 50, baseDef: 40, baseSpd: 30,
  spell: { id: 'stupeficium', name: 'Stupeficium', cooldown: 1 },
}

afterEach(() => vi.restoreAllMocks())

describe('UnitBust status badge keys', () => {
  it('renders distinct keys for two effects that share kind+statusId (no duplicate-key warning)', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    // Two shields with the same statusId previously collided on key `shield-shield`.
    const effects: ActiveEffect[] = [
      { kind: 'shield', statusId: 'shield', remaining: 2, absorbLeft: 10 },
      { kind: 'shield', statusId: 'shield', remaining: 3, absorbLeft: 20 },
    ]
    const { container } = render(<UnitBust unit={base} hp={100} effects={effects} />)

    // Both shield badges render...
    expect(container.querySelectorAll('[data-status-kind="shield"]').length).toBe(2)
    // ...and React did NOT warn about non-unique keys.
    const dupKeyWarned = err.mock.calls.some((args) =>
      args.some((a) => typeof a === 'string' && /same key/i.test(a)),
    )
    expect(dupKeyWarned).toBe(false)
  })
})
