import { describe, it, expect } from 'vitest'
import { TRAIT_BY_ID } from '@/data/traits'
import { STATUS_BY_ID } from '@/data/statuses'

function appliedStatusId(traitId: string): string | undefined {
  const t = TRAIT_BY_ID[traitId]!
  const eff = (t.trigger as any).effects?.()?.[0]
  return eff?.statusId
}

describe('trait rebalance', () => {
  it('Logoramento applies weaken2 (real -atk%)', () => {
    expect(appliedStatusId('logoramento')).toBe('weaken2')
  })
  it('Sifone applies slow1', () => {
    expect(appliedStatusId('sifone')).toBe('slow1')
  })
  it('Frantumazione exists and applies expose2', () => {
    expect(TRAIT_BY_ID['frantumazione']).toBeDefined()
    expect(appliedStatusId('frantumazione')).toBe('expose2')
  })
  it('Gelo exists and applies freeze', () => {
    expect(TRAIT_BY_ID['gelo']).toBeDefined()
    expect(appliedStatusId('gelo')).toBe('freeze')
  })
  it('every status id referenced by a trait exists', () => {
    for (const t of Object.values(TRAIT_BY_ID)) {
      const eff = (t.trigger as any).effects?.()?.[0]
      if (eff?.statusId) expect(STATUS_BY_ID[eff.statusId], `${t.id} → ${eff.statusId}`).toBeDefined()
    }
  })
})
