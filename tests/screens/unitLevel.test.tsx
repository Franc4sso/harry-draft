import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { UnitBust } from '@/components/battle/UnitBust'
import type { ReplayUnit } from '@/game/engine/combat/replay'

const unit: ReplayUnit = {
  key: 'left:harry', side: 'left', id: 'harry', name: 'Harry Potter',
  house: 'Grifondoro', role: 'Attaccante', tier: 1, maxHp: 100,
  atk: 50, def: 40, spd: 30, baseAtk: 50, baseDef: 40, baseSpd: 30, level: 1,
  spell: { id: 'stupeficium', name: 'Stupeficium', cooldown: 1 },
}

describe('UnitBust level badge', () => {
  it('shows the passed unit level', () => {
    render(<UnitBust unit={unit} hp={80} level={4} />)
    expect(screen.getByText(/Lv\.?\s*4/i)).toBeInTheDocument()
  })

  it('falls back to the unit own level when none is passed', () => {
    render(<UnitBust unit={{ ...unit, level: 7 }} hp={80} />)
    expect(screen.getByText(/Lv\.?\s*7/i)).toBeInTheDocument()
  })
})
