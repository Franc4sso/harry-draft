import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRunB } from '@/hooks/useRunB'
import { starterOffer } from '@/game/engine/runEngine'
import { clearRun } from '@/lib/runStore'

beforeEach(() => { try { clearRun() } catch {} ; localStorage.clear() })

describe('useRunB FSM', () => {
  it('starts at house selection with an empty team', () => {
    const { result } = renderHook(() => useRunB('seed-c'))
    expect(result.current.view).toBe('house')
    expect(result.current.run.team).toHaveLength(0)
  })

  it('house → starter exposes the chosen house offer', () => {
    const { result } = renderHook(() => useRunB('seed-c'))
    act(() => result.current.selectHouse('Grifondoro'))
    expect(result.current.view).toBe('starter')
    expect(result.current.house).toBe('Grifondoro')
    expect(result.current.starterOffer.every(d => d.wizard.house === 'Grifondoro')).toBe(true)
  })

  it('confirmStarters builds a 2-wizard team and enters the map', () => {
    const { result } = renderHook(() => useRunB('seed-c'))
    act(() => result.current.selectHouse('Grifondoro'))
    const ids = result.current.starterOffer.slice(0, 2).map(d => d.wizard.id)
    act(() => result.current.confirmStarters(ids))
    expect(result.current.view).toBe('map')
    expect(result.current.run.team).toHaveLength(2)
    expect(result.current.reachable.length).toBeGreaterThan(0)
  })

  it('resuming reads a saved run instead of restarting', () => {
    const first = renderHook(() => useRunB('seed-c'))
    act(() => first.result.current.selectHouse('Corvonero'))
    const ids = first.result.current.starterOffer.slice(0, 2).map(d => d.wizard.id)
    act(() => first.result.current.confirmStarters(ids))
    // a fresh hook on the same key resumes mid-run
    const second = renderHook(() => useRunB('seed-c'))
    expect(second.result.current.view).toBe('map')
    expect(second.result.current.run.team).toHaveLength(2)
  })

  it('restart clears the save and returns to house', () => {
    const { result } = renderHook(() => useRunB('seed-c'))
    act(() => result.current.selectHouse('Serpeverde'))
    act(() => result.current.restart())
    expect(result.current.view).toBe('house')
    expect(result.current.run.team).toHaveLength(0)
  })
})
