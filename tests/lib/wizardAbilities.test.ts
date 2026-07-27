import { describe, it, expect } from 'vitest'
import { WIZARDS } from '@/data/wizards'
import { abilityFor } from '@/lib/wizardAbilities'
import { epithetFor } from '@/lib/wizardEpithet'
import { SIGNATURE_BY_ID } from '@/data/signatures'

/**
 * Onda 1.d (2026-07-27): dopo la potatura del catalogo a 15 firme, `abilityFor` torna
 * `undefined` per un mago senza firma invece di inventare un ripiego per-ruolo.
 * L'assenza ha un solo modo di essere rappresentata, e la carta-poster salta la targa oro:
 * se ogni carta mostrasse comunque una targa, la rarita' della targa — cioe' tutto il
 * valore di questa onda — sarebbe distrutta.
 */
describe('wizardAbilities', () => {
  it('torna la firma del mago quando c\'e\'', () => {
    const withSig = WIZARDS.find(w => SIGNATURE_BY_ID[w.id])!
    const sig = SIGNATURE_BY_ID[withSig.id]!
    expect(abilityFor(withSig.id)).toEqual({ name: sig.name, blurb: sig.desc })
  })

  it('torna undefined per un mago senza firma (niente ripiego inventato)', () => {
    const withoutSig = WIZARDS.find(w => !SIGNATURE_BY_ID[w.id])!
    expect(abilityFor(withoutSig.id)).toBeUndefined()
  })

  it('esattamente 15 maghi su 60 hanno un\'abilita\' da mostrare', () => {
    const withAbility = WIZARDS.filter(w => abilityFor(w.id))
    expect(withAbility).toHaveLength(15)
    expect(WIZARDS).toHaveLength(60)
  })

  it('non lancia su un id sconosciuto', () => {
    expect(() => abilityFor('__nope__')).not.toThrow()
    expect(abilityFor('__nope__')).toBeUndefined()
  })

  it('ogni mago ha comunque un epiteto (non dipende dalle firme)', () => {
    for (const w of WIZARDS) expect(epithetFor(w.id), w.id).toBeTruthy()
  })
})
