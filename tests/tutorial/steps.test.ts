import { describe, it, expect } from 'vitest'
import { TUTORIAL_STEPS } from '@/components/tutorial/steps'

describe('TUTORIAL_STEPS', () => {
  it('has the 4 steps in order', () => {
    expect(TUTORIAL_STEPS.map(s => s.id)).toEqual(['draft', 'ruoli', 'autobattle', 'duo'])
  })
  it('draft & ruoli gate on the draft phase; autobattle on battle; duo on an active duo', () => {
    const byId = Object.fromEntries(TUTORIAL_STEPS.map(s => [s.id, s]))
    expect(byId.draft.when({ phase: 'draft', hasActiveDuo: false })).toBe(true)
    expect(byId.ruoli.when({ phase: 'draft', hasActiveDuo: false })).toBe(true)
    expect(byId.autobattle.when({ phase: 'battle', hasActiveDuo: false })).toBe(true)
    expect(byId.autobattle.when({ phase: 'draft', hasActiveDuo: false })).toBe(false)
    expect(byId.duo.when({ phase: 'battle', hasActiveDuo: true })).toBe(true)
    expect(byId.duo.when({ phase: 'draft', hasActiveDuo: false })).toBe(false)
  })
  it('every step has a non-empty anchor, title and body', () => {
    for (const s of TUTORIAL_STEPS) {
      expect(s.anchor.length).toBeGreaterThan(0)
      expect(s.title.length).toBeGreaterThan(0)
      expect(s.body.length).toBeGreaterThan(0)
    }
  })
})
