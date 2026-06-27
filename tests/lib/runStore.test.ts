import { describe, it, expect, beforeEach } from 'vitest'
import { saveRun, loadRun, clearRun, RUN_KEY } from '@/lib/runStore'
import type { RunState } from '@/types'

// jsdom provides localStorage in vitest's default environment; if not, shim it.
const mem: Record<string, string> = {}
beforeEach(() => {
  for (const k of Object.keys(mem)) delete mem[k]
  ;(globalThis as any).localStorage = {
    getItem: (k: string) => (k in mem ? mem[k] : null),
    setItem: (k: string, v: string) => { mem[k] = v },
    removeItem: (k: string) => { delete mem[k] },
  }
})

const sample: RunState = {
  seed: 's', phase: 'map', team: [], activeSynergies: [], stage: 0, relics: [],
  house: 'Tassorosso', area: 1, teamMax: 5, log: [], pendingLevelUps: [],
}

describe('runStore', () => {
  it('round-trips a run through save/load', () => {
    saveRun(sample)
    expect(loadRun()).toEqual(sample)
  })
  it('returns null when nothing is saved', () => {
    expect(loadRun()).toBeNull()
  })
  it('returns null for a malformed payload', () => {
    localStorage.setItem(RUN_KEY, '{not json')
    expect(loadRun()).toBeNull()
  })
  it('returns null for an incompatible version envelope', () => {
    localStorage.setItem(RUN_KEY, JSON.stringify({ version: 999, state: sample }))
    expect(loadRun()).toBeNull()
  })
  it('clearRun removes the saved run', () => {
    saveRun(sample)
    clearRun()
    expect(loadRun()).toBeNull()
  })
})
