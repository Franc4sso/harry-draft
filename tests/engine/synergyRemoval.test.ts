import { describe, it, expect } from 'vitest'
import { detectSynergies } from '@/game/engine/synergy'
import { houseEffects } from '@/game/engine/houseEffects'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARD_BY_ID } from '@/data/wizards'

function team(ids: string[]) {
  const r = createRng(1)
  return ids.map(id => draftWizard(r, WIZARD_BY_ID[id]!))
}

describe('rimozione sinergie role/house', () => {
  it('detectSynergies NON ritorna più sinergie di ruolo', () => {
    // harry, sirius, snape: tutti Attaccante
    const t = team(['harry', 'sirius', 'snape'])
    expect(detectSynergies(t).some(a => a.synergy.kind === 'role')).toBe(false)
  })
  it('detectSynergies NON ritorna più sinergie di casata', () => {
    // dumbledore, harry, mcgonagall, sirius: tutti Grifondoro
    const t = team(['dumbledore', 'harry', 'mcgonagall', 'sirius'])
    expect(detectSynergies(t).some(a => a.synergy.kind === 'house')).toBe(false)
  })
  it('houseEffects è vuoto (nessun potere di casata)', () => {
    const t = team(['dumbledore', 'harry', 'mcgonagall', 'sirius'])
    expect(Object.keys(houseEffects(t, detectSynergies(t)))).toHaveLength(0)
  })
  it('le sinergie group/origin RESTANO', () => {
    // bellatrix, pansy, blaise: tutti tag 'veleno' -> Tossicità (origin)
    const t = team(['bellatrix', 'pansy', 'blaise'])
    expect(detectSynergies(t).some(a => a.synergy.kind === 'origin')).toBe(true)
  })
})
