import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { UnitBust } from '@/components/battle/UnitBust'
import type { ReplayUnit } from '@/game/engine/combat/replay'
import type { ActiveEffect } from '@/types'

const unit = {
  key: 'left:x', id: 'x', name: 'X', side: 'left', house: 'Grifondoro', role: 'Attaccante', tier: 3,
  maxHp: 100, atk: 40, def: 20, spd: 30, baseAtk: 40, baseDef: 20, baseSpd: 30,
  spell: { id: 's', name: 'Incantesimo', cooldown: 0 },
} as unknown as ReplayUnit

// Buff/debuff do NOT render a top pill — the LIVE stat bars (▲/▼ + colour) show the
// change instead, so stacked buffs don't clutter the corner (e.g. "def+25" ×3).
it('weaken (debuff) does not render a status pill (the live stat bar shows it)', () => {
  const eff = { kind: 'debuff', statusId: 'weaken2', remaining: 2, stat: 'atk', amount: 25 } as unknown as ActiveEffect
  const { container } = render(<UnitBust unit={unit} hp={100} effects={[eff]} />)
  expect(container.querySelector('[data-status-kind="debuff"]')).toBeNull()
})
