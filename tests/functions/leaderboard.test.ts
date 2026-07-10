import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

let blobsMock = {
  getStore: vi.fn(),
}

vi.mock('@netlify/blobs', () => ({
  get getStore() {
    return blobsMock.getStore
  },
}))

import { readLeaderboard } from '@/netlify/functions/leaderboard'
import handler from '@/netlify/functions/leaderboard'

describe('leaderboard read', () => {
  beforeEach(() => {
    // Reset to default: return data out of order to test sort
    blobsMock.getStore = vi.fn(() => ({
      get: async () => JSON.stringify([{ nickname: 'B', score: 100, floor: 10 }, { nickname: 'A', score: 300, floor: 25 }]),
    }))
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('returns entries sorted by score desc', async () => {
    const list = await readLeaderboard()
    expect(list.map(e => e.score)).toEqual([300, 100])
  })

  it('handles store.get throw gracefully', async () => {
    blobsMock.getStore = vi.fn(() => ({
      get: async () => {
        throw new Error('Store error')
      },
    }))
    const response = await handler()
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('[]')
  })
})
