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
  it('the RunBRunner fixedOffer (guided trio only, from Tassorosso) forms the Duo with exactly 3 members', () => {
    // This is the exact restriction RunBRunner must apply to tutorialStarterOffer('Tassorosso')
    // before handing it to DraftScreen as `fixedOffer` — the whole offer restricted to just
    // the guided trio, so picking all 3 cards = picking the Duo, with no way to deviate.
    const offer = tutorialStarterOffer('Tassorosso')
    const fixedOffer = tutorialGuidedPickIds
      .map(id => offer.find(d => d.wizard.id === id))
      .filter((d): d is NonNullable<typeof d> => !!d)
    expect(fixedOffer).toHaveLength(3)
    const active = detectDuos(fixedOffer, []).map(a => a.duo.id)
    expect(active).toContain(TUTORIAL_DUO_ID)
  })
})
