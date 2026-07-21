import { describe, it, expect } from 'vitest'
import { detectSynergies } from '@/game/engine/synergy'
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
  it('resta solo Tossicità (origin), nessuna sinergia group', () => {
    const t = team(['bellatrix', 'pansy', 'blaise']) // 3 tag veleno
    const active = detectSynergies(t)
    expect(active.some(a => a.synergy.id === 'tossicita')).toBe(true)
    expect(active.some(a => a.synergy.kind === 'group')).toBe(false)
  })
})
