import { describe, it, expect } from 'vitest'
import { advanceEndlessArea, globalFloor } from '@/game/engine/endless'
import { startRunB, registerCoreResolvers } from '@/game/engine/runEngine'
import { createRng } from '@/game/engine/rng'
import { BALANCE } from '@/data/constants'

registerCoreResolvers()

describe('endless driver', () => {
  it('advanceEndlessArea never wins — generates a next area past the campaign final area', () => {
    const rng = createRng('endless-seed')
    let s = startRunB('endless-seed')
    // Force area to the campaign's last area; advancing must NOT produce 'win'.
    s = { ...s, area: BALANCE.map.areas - 1, team: s.team.length ? s.team : [] }
    const next = advanceEndlessArea(s, rng)
    expect(next.phase).not.toBe('win')
    expect(next.area).toBe(BALANCE.map.areas) // went PAST the campaign ceiling
  })

  it('advanceEndlessArea fully heals the roster at area boundary', () => {
    const rng = createRng('endless-heal')
    let s = startRunB('endless-heal')
    s = { ...s, area: 0, team: s.team.map(dw => ({ ...dw, currentHp: 1 })) }
    const next = advanceEndlessArea(s, rng)
    for (const dw of next.team) expect(dw.currentHp).toBe(dw.maxHp)
  })
})
