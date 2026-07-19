import { describe, it, expect } from 'vitest'
import { detectDuos } from '@/game/engine/duos'
import { tutorialStarterOffer, tutorialGuidedPickIds, TUTORIAL_DUO_ID } from '@/game/engine/tutorialOffer'

describe('tutorialStarterOffer', () => {
  it('offers at least 3 wizards', () => {
    expect(tutorialStarterOffer('Grifondoro').length).toBeGreaterThanOrEqual(3)
  })
  it('the guided trio forms the target Duo (no relics)', () => {
    const offer = tutorialStarterOffer('Grifondoro')
    const trio = tutorialGuidedPickIds.map(id => offer.find(d => d.wizard.id === id)!)
    expect(trio.every(Boolean)).toBe(true)
    const active = detectDuos(trio, []).map(a => a.duo.id)
    expect(active).toContain(TUTORIAL_DUO_ID)
  })
  it('is deterministic (same offer twice)', () => {
    const a = tutorialStarterOffer('Grifondoro').map(d => d.wizard.id)
    const b = tutorialStarterOffer('Grifondoro').map(d => d.wizard.id)
    expect(a).toEqual(b)
  })
})
