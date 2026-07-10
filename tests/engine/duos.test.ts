import { describe, it, expect } from 'vitest'
import { signalActive, detectDuos, duoProgress } from '@/game/engine/duos'
import type { DraftedWizard, ActiveRelic } from '@/types'

// minimal drafted-wizard factory
const dw = (id: string, role: string, tags: string[] = []): DraftedWizard =>
  ({ wizard: { id, role, house: 'Grifondoro', tags } , level: 1 } as unknown as DraftedWizard)
const relic = (r: Partial<ActiveRelic['relic']>): ActiveRelic =>
  ({ relic: { id: r.id ?? 'x', name: '', desc: '', rarity: 'comune', ...r } } as ActiveRelic)

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
