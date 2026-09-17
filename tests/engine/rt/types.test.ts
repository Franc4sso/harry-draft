// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { rtUnitKey } from '@/types/rt'
import { squad, unit, danno } from './fixtures'

describe('types rt', () => {
  it('rtUnitKey compone lato e id', () => {
    expect(rtUnitKey('left', 'harry')).toBe('left:harry')
  })
  it('squad assegna gli slot in ordine e salta gli undefined', () => {
    const s = squad({ id: 'a' }, undefined, { id: 'c' })
    expect(s.map(u => [u.id, u.slot])).toEqual([['a', 0], ['c', 2]])
  })
  it('unit ha una spell di danno per default', () => {
    expect(unit().spell.verb).toBe('danno')
    expect(danno(2).potenza).toBe(2)
  })
})
