import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RarityPips } from '@/components/cards/parts/RarityPips'
import type { Tier } from '@/types'

describe('RarityPips', () => {
  it('disegna sempre quattro tacche', () => {
    for (const t of [1, 2, 3, 4] as Tier[]) {
      const { unmount } = render(<RarityPips tier={t} />)
      expect(screen.getByTestId('rarity-pips').children).toHaveLength(4)
      unmount()
    }
  })

  it('accende una tacca per il comune e quattro per il leggendario', () => {
    const lit = (t: Tier) => {
      const { container, unmount } = render(<RarityPips tier={t} />)
      const n = container.querySelectorAll('[data-lit="true"]').length
      unmount()
      return n
    }
    expect(lit(4)).toBe(1)
    expect(lit(1)).toBe(4)
  })
})
