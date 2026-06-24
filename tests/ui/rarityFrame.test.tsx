import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { RarityFrame } from '@/components/ui/RarityFrame'

describe('RarityFrame', () => {
  it('marks the rarity label but renders no rarity icons (crown/gem)', () => {
    const { container, rerender } = render(<RarityFrame tier={1}>x</RarityFrame>)
    // data-rarity stays for styling/queries; the visible rarity cue is the TierBadge tag.
    expect(container.querySelector('[data-rarity="Leggendario"]')).toBeTruthy()
    expect(container.querySelector('[data-crown]')).toBeFalsy()
    expect(container.querySelector('[data-gem]')).toBeFalsy()
    rerender(<RarityFrame tier={3}>x</RarityFrame>)
    expect(container.querySelector('[data-crown]')).toBeFalsy()
    expect(container.querySelector('[data-gem]')).toBeFalsy()
  })
  it('does not paint a rarity-coloured border (the house frame owns the border)', () => {
    const { container } = render(<RarityFrame tier={1}>x</RarityFrame>)
    const el = container.querySelector('[data-rarity]') as HTMLElement
    // No coloured rarity border — empty or transparent/neutral only.
    expect(el.style.border === '' || /transparent|rgba\(0,\s*0,\s*0/.test(el.style.border)).toBe(true)
  })
  it('selected=true adds the white selection ring to boxShadow', () => {
    const { container } = render(<RarityFrame tier={4} selected>x</RarityFrame>)
    const el = container.querySelector('[data-rarity]') as HTMLElement
    expect(el.style.boxShadow).toMatch(/255,\s*255,\s*255/)
  })
  it('selected=false (or omitted) does not add the white ring', () => {
    const { container } = render(<RarityFrame tier={4}>x</RarityFrame>)
    const el = container.querySelector('[data-rarity]') as HTMLElement
    expect(el.style.boxShadow).not.toMatch(/255,\s*255,\s*255/)
  })
})
