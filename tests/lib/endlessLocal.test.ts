import { describe, it, expect, beforeEach } from 'vitest'
import { recordLocalBest, getLocalBests, getNickname, setNickname } from '@/lib/endlessLocal'

beforeEach(() => { localStorage.clear() })

describe('endless local storage', () => {
  it('records bests sorted by score desc', () => {
    recordLocalBest(100, 10); recordLocalBest(300, 25); recordLocalBest(200, 18)
    expect(getLocalBests().map(b => b.score)).toEqual([300, 200, 100])
  })
  it('stores and returns nickname', () => {
    expect(getNickname()).toBeNull()
    setNickname('Franc')
    expect(getNickname()).toBe('Franc')
  })
})
