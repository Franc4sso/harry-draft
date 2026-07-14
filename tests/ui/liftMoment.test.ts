import { describe, it, expect } from 'vitest'
import { liftMomentFor } from '@/components/battle/liftMoment'

const E = (flags: string[], extra: any = {}) =>
  ({ turn: 1, actorId: 'a', actorSide: 'left', targetId: 'b', targetSide: 'right', action: 'X', type: 'Attacco', flags, ...extra } as any)

describe('liftMomentFor', () => {
  it('un colpo che uccide → kill', () => {
    expect(liftMomentFor(E(['kill']))).toEqual({ kind: 'kill' })
  })
  it('un crit → crit', () => {
    expect(liftMomentFor(E(['crit']))).toEqual({ kind: 'crit' })
  })
  it('kill batte crit (priorità)', () => {
    expect(liftMomentFor(E(['crit', 'kill']))).toEqual({ kind: 'kill' })
  })
  it('un Duo drammatico che uccide (Esecuzione/Mietitore) → kill via il flag kill', () => {
    // I Duo d'attacco portano già `kill` → il lift scatta, ma come 'kill', non come 'duo'.
    expect(liftMomentFor(E(['kill', 'duo'], { duoId: 'mietitore' }))).toEqual({ kind: 'kill' })
  })
  it('un Duo PASSIVO (tick veleno di Cancrena) → null: niente volo su effetti passivi', () => {
    expect(liftMomentFor(E(['dot', 'duo'], { duoId: 'cancrena' }))).toBeNull()
  })
  it('un Duo passivo di sistema (Miasma/Untore/Muro) → null', () => {
    expect(liftMomentFor(E(['duo'], { duoId: 'miasma' }))).toBeNull()
  })
  it('un colpo normale → null', () => {
    expect(liftMomentFor(E([]))).toBeNull()
  })
  it('entry null → null', () => {
    expect(liftMomentFor(null)).toBeNull()
  })
})
