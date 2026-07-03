import { describe, it, expect } from 'vitest'
import { tickStatuses } from '@/game/engine/status'
import { simulateBattle } from '@/game/engine/combat/simulate'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARDS } from '@/data/wizards'
import type { ActiveEffect, BattleUnit } from '@/types'

function victim(id: string, side: 'left' | 'right', poison: ActiveEffect): BattleUnit {
  return {
    wizard: { id, name: id, role: 'Attaccante' }, side, hp: 100, maxHp: 100, alive: true,
    statusEffects: [poison], cooldowns: {}, buffedStats: { hp: 100, atk: 10, def: 10, spd: 10 },
  } as unknown as BattleUnit
}

describe('DoT attribution', () => {
  it('a poison tick is credited to the CASTER (source), not the victim', () => {
    const poison = { kind: 'dot', amount: 10, remaining: 3, stacks: 1, sourceId: 'right:bellatrix' } as unknown as ActiveEffect
    const harry = victim('harry', 'left', poison)
    const logs = tickStatuses(1, harry)
    const tick = logs.find(l => l.flags.includes('dot'))!
    expect(tick.actorId).toBe('bellatrix')
    expect(tick.actorSide).toBe('right')
    expect(tick.targetId).toBe('harry')
    expect(tick.targetSide).toBe('left')
  })

  it('a source-less DoT still ticks and is attributed to the bearer (no crash)', () => {
    const poison = { kind: 'dot', amount: 8, remaining: 2, stacks: 1 } as unknown as ActiveEffect
    const u = victim('nobody', 'left', poison)
    const logs = tickStatuses(1, u)
    const tick = logs.find(l => l.flags.includes('dot'))!
    expect(tick.actorId).toBe('nobody')
    expect(tick.value).toBe(8)
  })

  it('poison ticks in a real battle are attributed to a caster on the opposite side of the victim', () => {
    const poisoner = draftWizard(createRng(2), WIZARDS.find(w => w.id === 'narcissa')!) // has serpensortia (veleno)
    const bruiser = draftWizard(createRng(3), WIZARDS.find(w => w.id === 'harry')!)
    const res = simulateBattle([poisoner, bruiser], [draftWizard(createRng(4), WIZARDS.find(w => w.id === 'crabbe')!)], createRng(9))
    // Exclude self-inflicted anti-stall 'Fatica' ticks; every real poison/burn tick must be
    // attributed cross-side (caster's side != victim's side), never self-attributed.
    const poisonTicks = res.log.filter(l => l.flags.includes('dot') && l.action !== 'Fatica')
    for (const t of poisonTicks) expect(t.actorSide).not.toBe(t.targetSide)
    expect(res.mvpId).toBeTruthy()
  })
})
