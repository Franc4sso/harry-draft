import { describe, it, expect } from 'vitest'
import { NOTTURNO } from '@/lib/notturno'

describe('NOTTURNO palette', () => {
  it('exposes the agreed Notturno values', () => {
    expect(NOTTURNO.ink).toBe('#0a0813')
    expect(NOTTURNO.gold).toBe('#b08d57')
    expect(NOTTURNO.violet).toBe('#7c3aed')
  })
  it('every value is a hex color', () => {
    for (const v of Object.values(NOTTURNO)) expect(v).toMatch(/^#[0-9a-f]{6}$/i)
  })
})
