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
