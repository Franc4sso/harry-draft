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
  it('renders a stat row with ATT/DIF/VEL values', () => {
    render(<UnitBust unit={base} hp={100} />)
    const root = screen.getByTestId('battle-unit')
    const att = root.querySelector('[data-stat="ATT"]')!
    const dif = root.querySelector('[data-stat="DIF"]')!
    const vel = root.querySelector('[data-stat="VEL"]')!
    expect(att.textContent).toContain('50')
    expect(dif.textContent).toContain('40')
    expect(vel.textContent).toContain('30')
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
    expect(root.querySelector('[data-stat="ATT"]')!.getAttribute('data-buff')).toBe('up')
    expect(root.querySelector('[data-stat="DIF"]')!.getAttribute('data-buff')).toBe('none')
    expect(root.querySelector('[data-stat="VEL"]')!.getAttribute('data-buff')).toBe('down')
  })

  it('colors an up stat green and a down stat red', () => {
    const unit: ReplayUnit = {
      ...base,
      atk: 60, baseAtk: 50,
      spd: 20, baseSpd: 30,
    }
    render(<UnitBust unit={unit} hp={100} />)
    const root = screen.getByTestId('battle-unit')
    // StatBar uses text-emerald-300 for up, text-rose-300 for down on value span
    expect(root.querySelector('[data-stat="ATT"]')!.textContent).toContain('60')
    expect(root.querySelector('[data-stat="ATT"]')!.getAttribute('data-buff')).toBe('up')
    expect(root.querySelector('[data-stat="VEL"]')!.textContent).toContain('20')
    expect(root.querySelector('[data-stat="VEL"]')!.getAttribute('data-buff')).toBe('down')
  })
})
