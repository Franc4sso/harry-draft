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
    expect(container.querySelector('[data-gem]')).toBeTruthy()
  })
  it('comune has neither gem nor crown', () => {
    const { container } = render(<RarityFrame tier={4}>x</RarityFrame>)
    expect(container.querySelector('[data-gem]')).toBeFalsy()
    expect(container.querySelector('[data-crown]')).toBeFalsy()
  })
})
