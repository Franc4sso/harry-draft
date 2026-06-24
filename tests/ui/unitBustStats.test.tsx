import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { UnitBust } from '@/components/battle/UnitBust'
import type { ReplayUnit } from '@/game/engine/combat/replay'

/** Base unit with all stats unbuffed (buffed === base). */
const base: ReplayUnit = {
  key: 'left:harry', side: 'left', id: 'harry', name: 'Harry Potter',
  house: 'Grifondoro', role: 'Attaccante', tier: 1, maxHp: 100,
  atk: 50, def: 40, spd: 30,
  baseAtk: 50, baseDef: 40, baseSpd: 30,
  spell: { id: 'stupeficium', name: 'Stupeficium', cooldown: 1 },
}

describe('UnitBust stat row', () => {
  it('renders a stat row with atk/def/spd values', () => {
    render(<UnitBust unit={base} hp={100} />)
    const root = screen.getByTestId('battle-unit')
    const atk = root.querySelector('[data-stat="atk"]')!
    const def = root.querySelector('[data-stat="def"]')!
    const spd = root.querySelector('[data-stat="spd"]')!
    expect(atk.textContent).toContain('50')
    expect(def.textContent).toContain('40')
    expect(spd.textContent).toContain('30')
  })

  it('marks a buffed stat up, a base stat none, a debuffed stat down', () => {
    const unit: ReplayUnit = {
      ...base,
      atk: 60, baseAtk: 50,   // buffed up
      def: 40, baseDef: 40,   // base / equal
      spd: 20, baseSpd: 30,   // debuffed down
    }
    render(<UnitBust unit={unit} hp={100} />)
    const root = screen.getByTestId('battle-unit')
    expect(root.querySelector('[data-stat="atk"]')!.getAttribute('data-buff')).toBe('up')
    expect(root.querySelector('[data-stat="def"]')!.getAttribute('data-buff')).toBe('none')
    expect(root.querySelector('[data-stat="spd"]')!.getAttribute('data-buff')).toBe('down')
  })

  it('colors an up stat green and a down stat red', () => {
    const unit: ReplayUnit = {
      ...base,
      atk: 60, baseAtk: 50,
      spd: 20, baseSpd: 30,
    }
    render(<UnitBust unit={unit} hp={100} />)
    const root = screen.getByTestId('battle-unit')
    expect(root.querySelector('[data-stat="atk"]')!.className).toContain('text-emerald-400')
    expect(root.querySelector('[data-stat="spd"]')!.className).toContain('text-rose-400')
  })
})
