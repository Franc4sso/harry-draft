import { describe, it, expect } from 'vitest'
import { defaultProfile, markTutorialNudgeSeen, saveProfile, loadProfile, PROFILE_KEY } from '@/lib/metaStore'

describe('tutorialNudgeSeen', () => {
  it('defaults to false on a fresh profile', () => {
    expect(defaultProfile().tutorialNudgeSeen ?? false).toBe(false)
  })
  it('markTutorialNudgeSeen sets it true without mutating the input', () => {
    const p = defaultProfile()
    const next = markTutorialNudgeSeen(p)
    expect(next.tutorialNudgeSeen).toBe(true)
    expect(p.tutorialNudgeSeen ?? false).toBe(false) // pure
  })
  it('persists through save/load (localStorage round-trip)', () => {
    localStorage.removeItem(PROFILE_KEY)
    saveProfile(markTutorialNudgeSeen(defaultProfile()))
    expect(loadProfile().tutorialNudgeSeen).toBe(true)
  })
})
