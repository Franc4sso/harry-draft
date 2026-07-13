import { describe, it, expect } from 'vitest'
import { signalActive, detectDuos, duoProgress, signalCount } from '@/game/engine/duos'
import type { DraftedWizard, ActiveRelic } from '@/types'

// minimal drafted-wizard factory
const dw = (id: string, role: string, tags: string[] = []): DraftedWizard =>
  ({ wizard: { id, role, house: 'Grifondoro', tags } , level: 1 } as unknown as DraftedWizard)
const relic = (r: Partial<ActiveRelic['relic']>): ActiveRelic =>
  ({ relic: { id: r.id ?? 'x', name: '', desc: '', rarity: 'comune', ...r } } as ActiveRelic)

describe('signalCount', () => {
  it('taunt needs 1 Tank', () => {
    expect(signalCount('taunt', [dw('a', 'Tank')], [])).toEqual({ have: 1, need: 1, byRelic: false })
    expect(signalCount('taunt', [dw('a', 'Attaccante')], [])).toEqual({ have: 0, need: 1, byRelic: false })
  })
  it('role signal needs 2 of that role', () => {
    expect(signalCount('attaccante', [dw('a', 'Attaccante')], [])).toEqual({ have: 1, need: 2, byRelic: false })
    expect(signalCount('supporto', [dw('a', 'Supporto'), dw('b', 'Supporto')], [])).toEqual({ have: 2, need: 2, byRelic: false })
  })
  it('tag signal counts tagged mages (need 2)', () => {
    expect(signalCount('veleno', [dw('a', 'Attaccante', ['veleno'])], [])).toEqual({ have: 1, need: 2, byRelic: false })
    expect(signalCount('veleno', [dw('a', 'Attaccante', ['veleno']), dw('b', 'Tank', ['veleno'])], [])).toEqual({ have: 2, need: 2, byRelic: false })
  })
  it('a relic lighting a tag signal reports byRelic (have=need)', () => {
    expect(signalCount('veleno', [dw('a', 'Attaccante')], [relic({ keywords: ['veleno'] })])).toEqual({ have: 2, need: 2, byRelic: true })
    expect(signalCount('esecuzione', [dw('a', 'Tank')], [relic({ grantsExecute: { threshold: .3, bonus: .4 } })])).toEqual({ have: 2, need: 2, byRelic: true })
  })
})

describe('signalActive', () => {
  it('tag signal lights on >=2 tagged mages', () => {
    const team = [dw('a','Attaccante',['veleno']), dw('b','Tank',['veleno'])]
    expect(signalActive('veleno', team, [])).toBe(true)
  })
  it('tag signal does NOT light on 1 tagged mage and no relic', () => {
    expect(signalActive('veleno', [dw('a','Attaccante',['veleno'])], [])).toBe(false)
  })
  it('tag signal lights from a keyword relic alone', () => {
    expect(signalActive('veleno', [dw('a','Attaccante')], [relic({ keywords: ['veleno'] })])).toBe(true)
  })
  it('esecuzione lights from grantsExecute relic', () => {
    expect(signalActive('esecuzione', [dw('a','Tank')], [relic({ grantsExecute: { threshold: .3, bonus: .4 } })])).toBe(true)
  })
  it('taunt lights on a single Tank', () => {
    expect(signalActive('taunt', [dw('a','Tank')], [])).toBe(true)
  })
  it('attaccante needs >=2 of the role', () => {
    expect(signalActive('attaccante', [dw('a','Attaccante')], [])).toBe(false)
    expect(signalActive('attaccante', [dw('a','Attaccante'), dw('b','Attaccante')], [])).toBe(true)
  })
})

describe('detectDuos', () => {
  it('fires CANCRENA when veleno + esecuzione both lit', () => {
    const team = [dw('a','Attaccante',['veleno','esecuzione']), dw('b','Tank',['veleno','esecuzione'])]
    const ids = detectDuos(team, []).map(d => d.duo.id)
    expect(ids).toContain('cancrena')
  })
  it('does not fire a Duo with only one signal lit', () => {
    const team = [dw('a','Attaccante',['veleno']), dw('b','Tank',['veleno'])]
    expect(detectDuos(team, []).map(d => d.duo.id)).not.toContain('cancrena')
  })
})

describe('duoProgress', () => {
  it('reports the missing signal for a near Duo', () => {
    const team = [dw('a','Tank'), dw('b','Attaccante',['scudirigen']), dw('c','Sup',['scudirigen'])]
    const muro = duoProgress(team, []).find(p => p.duo.id === 'muro-vivente')!
    expect(muro.active).toBe(true) // taunt (1 Tank) + scudirigen (2 mages)
  })
})
