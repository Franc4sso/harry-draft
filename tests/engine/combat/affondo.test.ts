import { describe, it, expect } from 'vitest'
import { selectTarget } from '@/game/engine/combat/targeting'
import { mkUnit } from './_roleTestUtils'

describe('Affondo (Attaccante dive)', () => {
  const attacker = mkUnit({ id: 'att', role: 'Attaccante', side: 'left' })
  it('hits the enemy Tank while its taunt is active (taunt wins)', () => {
    const tank = mkUnit({ id: 'tank', role: 'Tank' })
    const sup = mkUnit({ id: 'sup', role: 'Supporto' })
    expect(selectTarget(attacker, [attacker], [tank, sup])?.wizard.id).toBe('tank')
  })
  it('dives the enemy Supporto when the Tank is stunned (taunt suppressed)', () => {
    const tank = mkUnit({ id: 'tank', role: 'Tank', statusEffects: [{ kind: 'stun', remaining: 1, stacks: 1 } as never] })
    const sup = mkUnit({ id: 'sup', role: 'Supporto' })
    expect(selectTarget(attacker, [attacker], [tank, sup])?.wizard.id).toBe('sup')
  })
  it('dives the enemy Supporto when there is no Tank at all', () => {
    const sup = mkUnit({ id: 'sup', role: 'Supporto' })
    const ctl = mkUnit({ id: 'ctl', role: 'Controllo' })
    expect(selectTarget(attacker, [attacker], [ctl, sup])?.wizard.id).toBe('sup')
  })
})
