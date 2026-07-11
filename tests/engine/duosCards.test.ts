import { describe, it, expect } from 'vitest'
import { wizardDuoSignals, duosForSignal, previewDuos, DUO_SIGNALS_IN_USE } from '@/game/engine/duos'
import type { DraftedWizard, Wizard } from '@/types'

const wiz = (id: string, role: string, tags: string[] = []): Wizard =>
  ({ id, name: id, role, house: 'Grifondoro', tags } as unknown as Wizard)
const dw = (id: string, role: string, tags: string[] = [], currentHp?: number): DraftedWizard =>
  ({ wizard: wiz(id, role, tags), level: 1, currentHp } as unknown as DraftedWizard)

describe('wizardDuoSignals (honesty)', () => {
  it('returns veleno for a veleno Attaccante but NOT attaccante (no shipped attaccante Duo)', () => {
    expect(wizardDuoSignals(wiz('a', 'Attaccante', ['veleno']))).toEqual(['veleno'])
  })
  it('returns nothing for a plain Attaccante', () => {
    expect(wizardDuoSignals(wiz('b', 'Attaccante', []))).toEqual([])
  })
  it('returns taunt + scudirigen for a scudirigen Tank', () => {
    expect(wizardDuoSignals(wiz('c', 'Tank', ['scudirigen']))).toEqual(['taunt', 'scudirigen'])
  })
  it('only reports signals actually used by a shipped Duo', () => {
    for (const w of ['Tank', 'Supporto', 'Controllo'] as const)
      for (const s of wizardDuoSignals(wiz('x', w, ['veleno', 'esecuzione', 'magieOscure'])))
        expect(DUO_SIGNALS_IN_USE.has(s)).toBe(true)
  })
})

describe('duosForSignal', () => {
  it('veleno feeds cancrena, miasma, untore', () => {
    expect(duosForSignal('veleno').map(d => d.id).sort()).toEqual(['cancrena', 'miasma', 'untore'])
  })
})

describe('previewDuos', () => {
  it('completes a Duo when the candidate lights the second signal', () => {
    // team already lights esecuzione (2 esecuzione mages); candidate brings the 2nd veleno -> CANCRENA
    const team = [dw('a', 'Attaccante', ['esecuzione', 'veleno']), dw('b', 'Tank', ['esecuzione'])]
    const cand = dw('c', 'Supporto', ['veleno'])
    const { completes } = previewDuos(team, [], cand)
    expect(completes.map(d => d.id)).toContain('cancrena')
  })
  it('does not count a fallen ally toward the preview', () => {
    // 'a' is the only other veleno mage but is DEAD -> candidate can't complete a veleno Duo
    const team = [dw('a', 'Attaccante', ['veleno', 'esecuzione'], 0), dw('b', 'Tank', ['esecuzione'])]
    const cand = dw('c', 'Supporto', ['veleno'])
    const { completes } = previewDuos(team, [], cand)
    expect(completes.map(d => d.id)).not.toContain('cancrena')
  })
})
