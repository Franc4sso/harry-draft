import { describe, it, expect } from 'vitest'
import { EVENTS, EVENT_BY_ID } from '@/data/events'

describe('event pool', () => {
  it('has a well-formed starter pool', () => {
    expect(EVENTS.length).toBeGreaterThanOrEqual(6)
    for (const e of EVENTS) {
      expect(e.id).toBeTruthy()
      expect(e.title).toBeTruthy()
      expect(e.text).toBeTruthy()
      expect(e.choices.length).toBeGreaterThanOrEqual(1)
      for (const c of e.choices) {
        expect(c.id).toBeTruthy()
        expect(c.label).toBeTruthy()
        expect(Array.isArray(c.effects)).toBe(true)
      }
    }
  })
  it('has unique event ids and unique choice ids within an event', () => {
    expect(new Set(EVENTS.map(e => e.id)).size).toBe(EVENTS.length)
    for (const e of EVENTS) {
      expect(new Set(e.choices.map(c => c.id)).size).toBe(e.choices.length)
    }
  })
  it('EVENT_BY_ID indexes every event', () => {
    for (const e of EVENTS) expect(EVENT_BY_ID[e.id]).toBe(e)
  })
})
