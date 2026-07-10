import { describe, it, expect, vi } from 'vitest'

vi.mock('@netlify/blobs', () => ({
  getStore: () => ({
    get: async () => JSON.stringify([{ nickname: 'A', score: 300, floor: 25 }, { nickname: 'B', score: 100, floor: 10 }]),
  }),
}))

import { readLeaderboard } from '@/netlify/functions/leaderboard'

describe('leaderboard read', () => {
  it('returns entries sorted by score desc', async () => {
    const list = await readLeaderboard()
    expect(list.map(e => e.score)).toEqual([300, 100])
  })
})
