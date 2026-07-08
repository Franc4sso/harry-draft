import { describe, it, expect } from 'vitest'
import { simulateBattle } from '@/game/engine/combat/simulate'
import { createRng } from '@/game/engine/rng'
import { SPELL_BY_ID } from '@/data/spells'
import type { DraftedWizard, Role } from '@/types'

// E2E proof of the IRON TAUNT rule (USER 2026-07-08): inside a real simulated battle,
// an enemy Controllo attacks the player's provoking Tank — it does NOT dive past it to the
// backline unless the Tank is hard-controlled. We assert on the actual combat log.

function dw(id: string, role: Role, spellId: string, over: Partial<Record<'hp' | 'atk' | 'def' | 'spd', number>> = {}): DraftedWizard {
  const s = { hp: 200, atk: 30, def: 20, spd: 25, ...over }
  return {
    wizard: {
      id, name: id, house: 'Grifondoro', role, tier: 3, gender: 'm',
      ranges: { hp: [s.hp, s.hp], atk: [s.atk, s.atk], def: [s.def, s.def], spd: [s.spd, s.spd] },
      spellPool: [spellId],
    },
    stats: s,
    maxHp: s.hp,
    spell: SPELL_BY_ID[spellId]!,
  }
}

describe('iron taunt — E2E in a real battle', () => {
  it('an enemy Controllo attacks the player Tank while it is provoking', () => {
    // Player: a lone provoking Tank + a squishy backliner the old code would have dived.
    const player = [dw('tank', 'Tank', 'base_attack'), dw('squish', 'Attaccante', 'base_attack', { hp: 60 })]
    // Enemy: a single Controllo carrying a SOFT control spell (confundo). Under the old rule
    // it would scavalca to 'squish'; under iron taunt it must hit 'tank'.
    const enemy = [dw('ctrl', 'Controllo', 'confundo')]

    const res = simulateBattle(player, enemy, createRng('iron'))

    // The first offensive action by the enemy Controllo must land on the tank.
    const ctrlHit = res.log.find(
      e => e.actorId === 'ctrl' && e.targetId && e.targetSide === 'left' && e.type !== 'system',
    )
    expect(ctrlHit, 'enemy Controllo took an offensive action against the player').toBeTruthy()
    expect(ctrlHit?.targetId).toBe('tank')
  })
})
