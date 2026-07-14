import { describe, it, expect } from 'vitest'
import { liftMomentFor } from '@/components/battle/liftMoment'

const E = (flags: string[], extra: any = {}) =>
  ({ turn: 1, actorId: 'a', actorSide: 'left', targetId: 'b', targetSide: 'right', action: 'X', type: 'Attacco', flags, ...extra } as any)

describe('liftMomentFor', () => {
  const noDuo = new Map<string, number>()
  it('un colpo che uccide → kill', () => {
    expect(liftMomentFor(E(['kill']), 3, noDuo)).toEqual({ kind: 'kill' })
  })
  it('un crit → crit', () => {
    expect(liftMomentFor(E(['crit']), 3, noDuo)).toEqual({ kind: 'crit' })
  })
  it('kill batte crit (priorità)', () => {
    expect(liftMomentFor(E(['crit', 'kill']), 3, noDuo)).toEqual({ kind: 'kill' })
  })
  it('primo scatto di un Duo → duo con nome', () => {
    const first = new Map([['cancrena', 5]])
    expect(liftMomentFor(E(['duo'], { duoId: 'cancrena' }), 5, first)).toEqual({ kind: 'duo', duoName: expect.any(String) })
  })
  it('scatto Duo NON-primo → null', () => {
    const first = new Map([['cancrena', 5]])
    expect(liftMomentFor(E(['duo'], { duoId: 'cancrena' }), 9, first)).toBeNull()
  })
  it('un colpo normale → null', () => {
    expect(liftMomentFor(E([]), 3, noDuo)).toBeNull()
  })
  it('entry null → null', () => {
    expect(liftMomentFor(null, 3, noDuo)).toBeNull()
  })
})
