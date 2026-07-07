import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDraft } from '@/hooks/useDraft'
import { BALANCE } from '@/data/constants'

describe('useDraft', () => {
  it('exposes a first screen of 5 and no picks', () => {
    const { result } = renderHook(() => useDraft('s1'))
    expect(result.current.current).toHaveLength(BALANCE.draft.screenSize)
    expect(result.current.picks).toHaveLength(0)
    expect(result.current.done).toBe(false)
    expect(result.current.teamSize).toBe(BALANCE.draft.teamSize)
  })
  it('pick advances picks and screen', () => {
    const { result } = renderHook(() => useDraft('s1'))
    const firstId = result.current.current[0]!.wizard.id
    act(() => result.current.pick(0))
    expect(result.current.picks).toHaveLength(1)
    expect(result.current.picks[0]!.wizard.id).toBe(firstId)
    expect(result.current.screenIndex).toBe(1)
  })
  it('completes after teamSize picks', () => {
    const { result } = renderHook(() => useDraft('s1'))
    for (let i = 0; i < BALANCE.draft.teamSize; i++) act(() => result.current.pick(0))
    expect(result.current.done).toBe(true)
    expect(result.current.picks).toHaveLength(BALANCE.draft.teamSize)
  })
})
