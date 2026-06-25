import { it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Sword } from 'lucide-react'
import { StatBar } from '@/components/battle/StatBar'

it('clamps fill to 100% and marks buff direction', () => {
  const { container } = render(<StatBar label="ATT" value={90} base={40} color="bg-rose-400" icon={Sword} />)
  const el = container.querySelector('[data-stat="ATT"]')!
  expect(el.getAttribute('data-buff')).toBe('up')          // 90 > 40
  const fill = el.querySelector('[data-role="fill"]') as HTMLElement
  expect(fill.style.width).toBe('100%')                     // 90/60 clamped
})

it('marks debuff when value below base', () => {
  const { container } = render(<StatBar label="VEL" value={20} base={30} color="bg-amber-400" icon={Sword} />)
  expect(container.querySelector('[data-stat="VEL"]')!.getAttribute('data-buff')).toBe('down')
})
