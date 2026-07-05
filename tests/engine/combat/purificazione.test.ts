import { describe, it, expect } from 'vitest'
import { cleanseOneControl } from '@/game/engine/combat/roleCounter'
import { mkUnit } from './_roleTestUtils'

describe('Purificazione', () => {
  it('removes one hard-control effect from the most-disabled living ally', () => {
    const clean = mkUnit({ id: 'a', role: 'Attaccante' })
    const stunned = mkUnit({ id: 'b', role: 'Attaccante', statusEffects: [{ kind: 'stun', remaining: 2, stacks: 1 } as never, { kind: 'silence', remaining: 2, stacks: 1 } as never] })
    const who = cleanseOneControl([clean, stunned])
    expect(who?.wizard.id).toBe('b')
    expect(stunned.statusEffects.filter(e => ['stun','freeze','silence'].includes(e.kind)).length).toBe(1)
  })
  it('returns undefined when no ally is hard-controlled', () => {
    expect(cleanseOneControl([mkUnit({ id: 'a', role: 'Tank' })])).toBeUndefined()
  })
})
