import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { RarityFrame } from '@/components/ui/RarityFrame'

describe('RarityFrame', () => {
  it('marks rarity and shows crown only for leggendario', () => {
    const { container, rerender } = render(<RarityFrame tier={1}>x</RarityFrame>)
    expect(container.querySelector('[data-rarity="Leggendario"]')).toBeTruthy()
    expect(container.querySelector('[data-crown]')).toBeTruthy()
    rerender(<RarityFrame tier={3}>x</RarityFrame>)
    expect(container.querySelector('[data-crown]')).toBeFalsy()
  })
  it('no longer renders the rarity gem (removed for a cleaner frame)', () => {
    const { container, rerender } = render(<RarityFrame tier={3}>x</RarityFrame>)
    expect(container.querySelector('[data-gem]')).toBeFalsy()
    rerender(<RarityFrame tier={4}>x</RarityFrame>)
    expect(container.querySelector('[data-gem]')).toBeFalsy()
    expect(container.querySelector('[data-crown]')).toBeFalsy()
  })
  it('selected=true adds the white ring to boxShadow', () => {
    const { container } = render(<RarityFrame tier={4} selected>x</RarityFrame>)
    const el = container.querySelector('[data-rarity]') as HTMLElement
    expect(el.style.boxShadow).toMatch(/255,\s*255,\s*255/)
    expect(el.style.boxShadow).toContain('2px')
  })
  it('selected=false (or omitted) does not add the white ring', () => {
    const { container } = render(<RarityFrame tier={4}>x</RarityFrame>)
    const el = container.querySelector('[data-rarity]') as HTMLElement
    expect(el.style.boxShadow).not.toMatch(/255,\s*255,\s*255/)
  })
})
