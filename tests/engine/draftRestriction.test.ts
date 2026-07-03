import { describe, it, expect, afterEach } from 'vitest'
import { createDraftPool, setDraftPoolRestriction } from '@/game/engine/draft'
import { WIZARDS } from '@/data/wizards'

afterEach(() => setDraftPoolRestriction(null))

describe('draft pool restriction', () => {
  it('returns all wizards when no restriction is set', () => {
    expect(createDraftPool().length).toBe(WIZARDS.length)
  })
  it('returns only the restricted subset', () => {
    setDraftPoolRestriction(['harry', 'ron'])
    const ids = createDraftPool().map(w => w.id).sort()
    expect(ids).toEqual(['harry', 'ron'])
  })
  it('clearing the restriction restores the full pool', () => {
    setDraftPoolRestriction(['harry'])
    setDraftPoolRestriction(null)
    expect(createDraftPool().length).toBe(WIZARDS.length)
  })
})
