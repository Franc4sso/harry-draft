import { describe, it, expect } from 'vitest'
import { simulateBattle } from '@/game/engine/combat/simulate'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARDS } from '@/data/wizards'

const wiz = (id: string, seed: number) => draftWizard(createRng(seed), WIZARDS.find(w => w.id === id)!)

describe('on-hit riders require the attack to connect', () => {
  it('a Sifone attack that never lands never applies its spd debuff ("dodged but poisoned" cannot happen)', () => {
    // Bellatrix carries Sifone (spd debuff on hit). If every attack she makes on Harry is
    // dodged (none connect), Harry must NEVER receive the spd debuff — the rider fires only
    // on a landed hit. Search seeds for a battle exhibiting the all-dodged case.
    const bella = { ...wiz('bellatrix', 2), shiny: { traitId: 'sifone' } }
    let exercised = false
    for (let s = 1; s <= 400 && !exercised; s++) {
      const res = simulateBattle([wiz('harry', 1)], [bella], createRng(s))
      const onHarry = res.log.filter(l => l.actorId === 'bellatrix' && l.targetId === 'harry')
      const dodged = onHarry.filter(l => l.flags.includes('dodge') || l.flags.includes('block'))
      const connected = onHarry.filter(l => !l.flags.includes('dodge') && !l.flags.includes('block'))
      if (dodged.length >= 1 && connected.length === 0) {
        const debuffed = res.snapshots.some(sn =>
          Object.values(sn).some(u => u.statusEffects.some(e => e.kind === 'debuff' && e.stat === 'spd')))
        expect(debuffed).toBe(false)
        exercised = true
      }
    }
    expect(exercised).toBe(true)
  })
})
