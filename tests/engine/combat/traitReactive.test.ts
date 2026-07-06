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
    // Lupin (benedizione) has episkey/vulnera in his spell pool — he heals himself.
    // onHeal fires with actor=lupin, target=lupin; shield EffectSpec lands on ctx.target=lupin.
    // A healer ally (mcgonagall) ensures heals happen regularly; harry is the right-side target.
    // Seed 14 gives Lupin the 'vulnera' healing spell (Supporto archetype rewrite shifted spell picks).
    const lupin = { ...wiz('lupin', 14), shiny: { traitId: 'benedizione' } }
    const left = [lupin, wiz('mcgonagall', 2)]
    const right = [wiz('harry', 3)]
    const res = simulateBattle(left, right, createRng(0))
    // Some snapshot must show a unit with statusId:'shield' (set by the shield handler)
    // or kind:'shield' (belt-and-suspenders match for inline shield push).
    const shielded = res.snapshots.some(s =>
      Object.values(s).some(u => u.statusEffects.some(e => e.statusId === 'shield' || e.kind === 'shield')))
    expect(shielded).toBe(true)
  })
})
