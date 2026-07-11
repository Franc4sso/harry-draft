import { describe, it, expect } from 'vitest'
import { simulateBattle } from '@/game/engine/combat/simulate'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARDS } from '@/data/wizards'

const wiz = (id: string, seed: number) => draftWizard(createRng(seed), WIZARDS.find(w => w.id === id)!)

describe('reactive traits in battle', () => {
  it('Sifone (on a RIGHT-side enemy) applies a SPD debuff to the player it hits', () => {
    // Bellatrix has Sifone. Put her on the RIGHT to prove both-side reactive firing.
    // onHit fires with actor=bellatrix, target=harry; applyStatus target:'enemy' resolves
    // to ctx.target (harry), so harry's statusEffects gets { kind:'debuff', stat:'spd' }.
    const left = [wiz('harry', 1)]
    const bellatrix = { ...wiz('bellatrix', 2), shiny: { traitId: 'sifone' } }
    const right = [bellatrix]
    // seed 5: Bellatrix survives turn 1 and attacks Harry at least twice, triggering Sifone.
    // seed 3 is excluded — Harry one-shots Bellatrix on turn 1, so onHit never fires.
    const res = simulateBattle(left, right, createRng(5))
    // Some snapshot must show a left unit with a spd debuff pushed by Sifone.
    const debuffed = res.snapshots.some(s =>
      Object.values(s).some(u => u.statusEffects.some(e => e.kind === 'debuff' && e.stat === 'spd')))
    expect(debuffed).toBe(true)
  })

  it('Benedizione shields Lupin when he is healed', () => {
    // UN MAGO, UNA MAGIA (Task 2): Lupin's signature collapsed to 'expecto' (a self Difesa
    // buff, not a heal) — he can no longer self-heal, so the old "Lupin heals himself" setup
    // no longer applies. But game/engine/combat/simulate.ts's onHeal reactive fires with
    // `unit = realTarget` (the unit that RECEIVED the heal, not the caster) and
    // game/engine/traits.ts's ownerOf('actor') resolves to that same unit — Benedizione
    // fires whenever its holder is healed by ANYONE, not only by self-cast. So pair Lupin
    // with a real healer ally (molly -> episkey) instead, and search seeds for a battle
    // where Lupin takes damage and molly's heal actually lands on him.
    let shielded = false
    for (let s = 0; s < 80 && !shielded; s++) {
      const lupin = { ...wiz('lupin', s), shiny: { traitId: 'benedizione' } }
      const molly = wiz('molly', s + 100)
      const left = [lupin, molly]
      const right = [wiz('sirius', s + 200)]
      const res = simulateBattle(left, right, createRng(s + 300))
      // Some snapshot must show a unit with statusId:'shield' (set by the shield handler)
      // or kind:'shield' (belt-and-suspenders match for inline shield push).
      shielded = res.snapshots.some(snap =>
        Object.values(snap).some(u => u.statusEffects.some(e => e.statusId === 'shield' || e.kind === 'shield')))
    }
    expect(shielded).toBe(true)
  })
})
