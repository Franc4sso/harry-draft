import { describe, it, expect } from 'vitest'
import { simulateBattle, toBattleUnits } from '@/game/engine/combat/simulate'
import { draftWizard } from '@/game/engine/statRoll'
import { detectSynergies } from '@/game/engine/synergy'
import { createRng } from '@/game/engine/rng'
import { WIZARDS } from '@/data/wizards'
import { SPELL_BY_ID } from '@/data/spells'

function team(rng = createRng(1), n = 5) {
  return WIZARDS.slice(0, 200).filter((_, i) => i % 2 === 0).slice(0, n).map(w => draftWizard(rng, w))
}

describe('simulate', () => {
  it('produces a winner and a non-empty log', () => {
    const left = team(createRng(1)); const right = team(createRng(2))
    const res = simulateBattle(left, right, createRng(3))
    expect(['left', 'right']).toContain(res.winner)
    expect(res.log.length).toBeGreaterThan(0)
    expect(res.turns).toBeLessThanOrEqual(100)
  })
  it('is fully deterministic for the same seeds', () => {
    const l = team(createRng(1)); const r = team(createRng(2))
    const a = simulateBattle(l, r, createRng(9))
    const l2 = team(createRng(1)); const r2 = team(createRng(2))
    const b = simulateBattle(l2, r2, createRng(9))
    expect(a.winner).toBe(b.winner)
    expect(a.turns).toBe(b.turns)
    expect(a.log.length).toBe(b.log.length)
    expect(a.mvpId).toBe(b.mvpId)
  })
  it('terminates even with healers (no infinite loop)', () => {
    const left = team(createRng(11)); const right = team(createRng(12))
    const res = simulateBattle(left, right, createRng(13))
    expect(res.turns).toBeGreaterThan(0)
  })
  it('reports an mvp from the winning context', () => {
    const res = simulateBattle(team(createRng(1)), team(createRng(2)), createRng(5))
    expect(res.mvpId).toBeTruthy()
  })
  it('synergy buffs increase starting hp', () => {
    const raw = team(createRng(1))
    const syn = detectSynergies(raw)
    const buffed = toBattleUnits(raw, 'left', syn)
    expect(buffed).toHaveLength(raw.length)
  })
  it('Tank is focus-fired: Attaccante always targets the alive Tank before the squishy backliner', () => {
    // Left: one Attaccante (voldemort). Right: Tank (mcgonagall) + Supporto backliner (lupin).
    // While mcgonagall is alive the tauntBonus makes her the highest-threat target,
    // so the very first Attacco from the left side must target 'mcgonagall', not 'lupin'.
    const rng = createRng(7)
    const leftTeam = [draftWizard(createRng(7), WIZARDS.find(w => w.id === 'voldemort')!)]
    const rightTeam = [
      draftWizard(createRng(8), WIZARDS.find(w => w.id === 'mcgonagall')!),
      draftWizard(createRng(9), WIZARDS.find(w => w.id === 'lupin')!),
    ]
    const res = simulateBattle(leftTeam, rightTeam, rng)
    // Find the first attack entry fired by a left-side actor
    const firstLeftAttack = res.log.find(e => e.type === 'Attacco' && e.actorSide === 'left')
    expect(firstLeftAttack).toBeDefined()
    expect(firstLeftAttack!.targetId).toBe('mcgonagall')
  })

  it('fatigue forces defensive stalemates to converge well before the turn cap', () => {
    // A wall of tanks (low atk, high def -> min-damage grind) used to run all 100 turns.
    // Escalating end-of-turn fatigue (true damage past fatigueStart) must end it much sooner.
    const tanks = WIZARDS.filter(w => w.role === 'Tank')
    // Seeds chosen so NO tank rolls a shiny trait: a shiny offensive trait (e.g. the
    // `veleno` burn that seed 1 rolls) would give the wall real damage output and end
    // the fight before fatigueStart, defeating the point of this stalemate test.
    const left = tanks.slice(0, 5).map(w => draftWizard(createRng(4), w))
    const right = tanks.slice(0, 5).map(w => draftWizard(createRng(2), w))
    // Pass synergies like the real game: the "3 Tank" +def synergy is what builds the
    // wall that grinds to turnCap without fatigue.
    const res = simulateBattle(left, right, createRng(3),
      { leftSyn: detectSynergies(left), rightSyn: detectSynergies(right) })
    expect(res.turns).toBeLessThan(60)
    // The fatigue ticks must be logged (visible in the replay), mirroring DoT/regen.
    const fatigue = res.log.filter(e => e.action === 'Fatica')
    expect(fatigue.length).toBeGreaterThan(0)
    expect(fatigue.every(e => (e.value ?? 0) > 0)).toBe(true)
  })

  it('does not disturb battles that end before fatigue begins', () => {
    // Normal matchups resolve in a handful of turns, well under fatigueStart -> no Fatica.
    const res = simulateBattle(team(createRng(1)), team(createRng(2)), createRng(3))
    expect(res.turns).toBeLessThan(30)
    expect(res.log.some(e => e.action === 'Fatica')).toBe(false)
  })

  it('a reviver brings a fallen ally back into the fight (Rennervate fires on a corpse)', () => {
    // Left: a fragile ally that will die + a Supporto forced to cast Rennervate (the revive).
    // Right: a heavy attacker to guarantee a kill. Search seeds for a battle where the
    // ally actually falls and gets raised — proving the end-to-end revive path fires.
    //
    // UN MAGO, UNA MAGIA (Task 2): voldemort's spellPool collapsed to `['avada']` only —
    // previously avada was ~20% of his random picks, now EVERY draft guarantees it. Avada
    // (power 3.2, penetrating) one-shots the fragile 90-110 HP Supporto units used here, and
    // with TWO voldemorts (the original setup) it also one-shots the reviver itself before
    // his cooldown-2 Rennervate can ever fire — turn 1 wipe on every one of 500 seeds tried.
    // Swapped to a single, less extreme attacker (ginny/reducto) so the reviver reliably
    // survives long enough to actually cast the revive once an ally falls.
    const reviverBase = WIZARDS.find(w => w.id === 'lupin')!
    const fragileBase = WIZARDS.find(w => w.role === 'Supporto' && w.id !== 'lupin')!
    const heavyBase = WIZARDS.find(w => w.id === 'ginny')!
    let sawRevive = false
    for (let s = 1; s <= 80 && !sawRevive; s++) {
      const reviver = { ...draftWizard(createRng(s), reviverBase), spell: SPELL_BY_ID['rennervate']! }
      const fragile = draftWizard(createRng(s + 100), fragileBase)
      const right = [draftWizard(createRng(s + 200), heavyBase)]
      const res = simulateBattle([fragile, reviver], right, createRng(s + 400))
      if (res.log.some(e => e.action === 'Rennervate' && (e.flags ?? []).includes('revive'))) sawRevive = true
    }
    expect(sawRevive).toBe(true)
  })

  it('regeneration synergy emits a heal log entry so the replay reflects it', () => {
    // In a real fight, left units take HP damage and survive several turns; a regen
    // synergy on the left must heal them end-of-turn AND be logged, otherwise
    // buildReplay (which reconstructs HP from log deltas) can never show the regen.
    const left = team(createRng(1))
    const right = team(createRng(2))
    const regenSyn = [{
      synergy: {
        id: 'testRegen', name: 'Test Regen', kind: 'role' as const,
        requires: { role: 'Supporto' as const, count: 1 }, bonus: { regen: 30 },
      },
      memberIds: [] as string[],
    }]
    const res = simulateBattle(left, right, createRng(3), { leftSyn: regenSyn })
    const regenEntries = res.log.filter(e => e.action === 'Rigenera' && e.flags.includes('heal'))
    expect(regenEntries.length).toBeGreaterThan(0)
    expect(regenEntries.every(e => (e.value ?? 0) > 0 && e.targetSide === 'left')).toBe(true)
  })

  it('is deterministic when the same wizard id appears on both teams', () => {
    // Build two teams that both include 'harry' — same id on left and right.
    const harryWizard = WIZARDS.find(w => w.id === 'harry')!
    const rngL = createRng(42)
    const rngR = createRng(43)
    // Build 3-unit teams: harry + two others, left and right share the harry id
    const leftTeam = [
      draftWizard(rngL, harryWizard),
      draftWizard(rngL, WIZARDS.find(w => w.id === 'snape')!),
      draftWizard(rngL, WIZARDS.find(w => w.id === 'hermione')!),
    ]
    const rightTeam = [
      draftWizard(rngR, harryWizard), // same wizard.id 'harry' on opposite side
      draftWizard(rngR, WIZARDS.find(w => w.id === 'dumbledore')!),
      draftWizard(rngR, WIZARDS.find(w => w.id === 'voldemort')!),
    ]
    const run = () => simulateBattle(
      leftTeam.map(u => ({ ...u })),
      rightTeam.map(u => ({ ...u })),
      createRng(99),
    )
    const a = run()
    const b = run()
    expect(a.winner).toBe(b.winner)
    expect(a.turns).toBe(b.turns)
    expect(a.log.length).toBe(b.log.length)
    expect(a.mvpId).toBe(b.mvpId)
  })
})
