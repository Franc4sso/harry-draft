import { describe, it, expect } from 'vitest'
import { defaultProfile, markSeen } from '@/lib/metaStore'

describe('duosSeen codex', () => {
  it('defaults to empty and records a discovery once', () => {
    let p = defaultProfile()
    expect(p.codex.duosSeen).toEqual([])
    p = markSeen(p, 'duo', 'cancrena')
    p = markSeen(p, 'duo', 'cancrena')
    expect(p.codex.duosSeen).toEqual(['cancrena'])
  })
})
