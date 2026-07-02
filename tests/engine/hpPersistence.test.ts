import { describe, it, expect } from 'vitest'
import { starterOffer } from '@/game/engine/runEngine'
import { battleReadyTeam } from '@/game/engine/battlePrep'
import { toBattleUnits } from '@/game/engine/combat/simulate'
import { applyBattleToRoster } from '@/game/engine/run'
import type { UnitSnapshot } from '@/types'

/**
 * Regression guard for the user-reported "HP resets at the start of the next battle".
 * Walks the real persistence chain with a FORCED wound and asserts the next battle does
 * NOT start at full HP.
 */
describe('HP persistence across battles', () => {
  const dw = starterOffer('run-0', 'Grifondoro')[0]!
  const maxHp = dw.maxHp

  it('battleReadyTeam carries the wound fraction (does not restore to full)', () => {
    expect(maxHp).toBeGreaterThan(0)
    const wounded = { ...dw, currentHp: Math.round(maxHp * 0.5) } // 50%
    const ready = battleReadyTeam([wounded])[0]!
    expect(ready.currentHp).toBeDefined()
    // ~50% of the (possibly re-leveled) pool — NOT full.
    expect(ready.currentHp! / ready.maxHp).toBeLessThan(0.6)
  })

  it('the resulting battle unit STARTS wounded (not at max HP)', () => {
    const wounded = { ...dw, currentHp: Math.round(maxHp * 0.5) }
    const ready = battleReadyTeam([wounded])[0]!
    const unit = toBattleUnits([ready], 'left', [], [])[0]!
    expect(unit.hp).toBeLessThan(unit.maxHp) // if this were a reset, hp === maxHp
    expect(unit.hp / unit.maxHp).toBeLessThan(0.65)
  })

  it('applyBattleToRoster persists a survivor at its post-battle HP fraction', () => {
    // Simulate a fight that left the wizard at 40% via the finalSnapshot.
    const snap: UnitSnapshot[] = [{ id: dw.wizard.id, side: 'left', hp: Math.round(maxHp * 0.4), maxHp, alive: true }]
    const persisted = applyBattleToRoster([dw], snap)[0]!
    expect(persisted.currentHp).toBeDefined()
    expect(persisted.currentHp! / persisted.maxHp).toBeLessThan(0.5) // ~40%, not full
    expect(persisted.currentHp).toBeGreaterThan(0)
  })
})
