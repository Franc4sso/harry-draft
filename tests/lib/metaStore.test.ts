import { describe, it, expect, beforeEach } from 'vitest'
import {
  PROFILE_KEY, defaultProfile, loadProfile, saveProfile,
  grantCioccorane, spendCioccorane, unlockWizard, markSeen,
} from '@/lib/metaStore'

beforeEach(() => localStorage.clear())

describe('metaStore', () => {
  it('returns a fresh default profile when storage is empty', () => {
    const p = loadProfile()
    expect(p.version).toBe(1)
    expect(p.cioccorane).toBe(0)
    expect(p.unlockedWizards).toEqual([])
    expect(p.codex.wizardsSeen).toEqual([])
  })

  it('round-trips a saved profile', () => {
    const p = grantCioccorane(defaultProfile(), 50)
    saveProfile(p)
    expect(loadProfile().cioccorane).toBe(50)
  })

  it('returns a default (never throws) on corrupt JSON', () => {
    localStorage.setItem(PROFILE_KEY, '{not json')
    expect(loadProfile().cioccorane).toBe(0)
  })

  it('spendCioccorane returns null when insufficient and never goes negative', () => {
    const p = grantCioccorane(defaultProfile(), 30)
    expect(spendCioccorane(p, 40)).toBeNull()
    expect(spendCioccorane(p, 30)!.cioccorane).toBe(0)
  })

  it('unlockWizard is idempotent', () => {
    const once = unlockWizard(defaultProfile(), 'luna')
    const twice = unlockWizard(once, 'luna')
    expect(twice.unlockedWizards).toEqual(['luna'])
  })

  it('markSeen dedupes and is pure', () => {
    const base = defaultProfile()
    const seen = markSeen(markSeen(base, 'wizard', 'draco'), 'wizard', 'draco')
    expect(seen.codex.wizardsSeen).toEqual(['draco'])
    expect(base.codex.wizardsSeen).toEqual([]) // input not mutated
  })
})
