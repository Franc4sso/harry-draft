import { describe, it, expect } from 'vitest'
import { WIZARDS } from '@/data/wizards'
import { abilityFor } from '@/lib/wizardAbilities'
import { epithetFor } from '@/lib/wizardEpithet'
import { SIGNATURE_BY_ID } from '@/data/signatures'

describe('wizardAbilities', () => {
  it('every wizard resolves to a personal ability (name + blurb)', () => {
    for (const w of WIZARDS) {
      const a = abilityFor(w.id)
      expect(a.name, w.id).toBeTruthy()
      expect(a.blurb, w.id).toBeTruthy()
    }
  })

  it('the ability is the wizard signature when present', () => {
    const withSig = WIZARDS.find(w => SIGNATURE_BY_ID[w.id])!
    const sig = SIGNATURE_BY_ID[withSig.id]!
    expect(abilityFor(withSig.id)).toEqual({ name: sig.name, blurb: sig.desc })
  })

  it('abilityFor never throws for an unknown id (role/plain fallback)', () => {
    expect(() => abilityFor('__nope__')).not.toThrow()
    expect(abilityFor('__nope__').name).toBeTruthy()
  })

  it('every wizard has an epithet', () => {
    for (const w of WIZARDS) expect(epithetFor(w.id), w.id).toBeTruthy()
  })
})
