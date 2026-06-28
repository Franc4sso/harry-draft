import { describe, it, expect } from 'vitest'
import type { BattleUnit } from '@/types'
import { applyStatus, tickStatuses } from '@/game/engine/status'

/** Minimal BattleUnit with only the fields tickStatuses/applyStatus read. */
function mkUnit(maxHp = 100): BattleUnit {
  return {
    wizard: { id: 'dummy' },
    side: 'right',
    hp: maxHp,
    maxHp,
    cooldowns: {},
    statusEffects: [],
    alive: true,
  } as unknown as BattleUnit
}

describe('veleno: accumulate stack policy', () => {
  it('grows a single entry up to maxStacks, then caps', () => {
    const u = mkUnit()
    for (let i = 0; i < 12; i++) applyStatus(u, 'veleno')
    const entries = u.statusEffects.filter(e => e.statusId === 'veleno')
    expect(entries).toHaveLength(1)          // one entry, not many
    expect(entries[0]!.stacks).toBe(8)       // capped at maxStacks
  })

  it('refreshes remaining duration on reapply', () => {
    const u = mkUnit()
    applyStatus(u, 'veleno')
    const e = u.statusEffects.find(x => x.statusId === 'veleno')!
    e.remaining = 1
    applyStatus(u, 'veleno')
    expect(e.remaining).toBe(2)              // refreshed to defaultDuration
    expect(e.stacks).toBe(2)
  })
})

describe('veleno: "che divora" tick (no mult yet)', () => {
  it('deals stacks*flat + min(stacks,8)*0.5%maxHp', () => {
    const u = mkUnit(200)
    for (let i = 0; i < 5; i++) applyStatus(u, 'veleno')   // 5 stacks
    const before = u.hp
    tickStatuses(1, u)
    // flat 5*4=20 ; pct min(5,8)*0.005*200=5 ; total 25
    expect(before - u.hp).toBe(25)
  })

  it('caps the %maxHp component at 8 stacks but not the flat', () => {
    const u = mkUnit(1000)
    for (let i = 0; i < 12; i++) applyStatus(u, 'veleno')  // stacks cap at 8
    const before = u.hp
    tickStatuses(1, u)
    // stacks=8 ; flat 8*4=32 ; pct min(8,8)*0.005*1000=40 ; total 72
    expect(before - u.hp).toBe(72)
  })

  it('does not route through shields (bypasses absorb)', () => {
    const u = mkUnit(100)
    u.statusEffects.push({ kind: 'shield', statusId: 'shield', remaining: 3, stacks: 1, absorbLeft: 50 })
    applyStatus(u, 'veleno')                                // 1 stack
    const before = u.hp
    tickStatuses(1, u)
    // flat 1*4=4 ; pct 1*0.005*100=0.5 ; round(4.5)=5 ; shield untouched
    expect(before - u.hp).toBe(5)
    expect(u.statusEffects.find(e => e.statusId === 'shield')!.absorbLeft).toBe(50)
  })
})
