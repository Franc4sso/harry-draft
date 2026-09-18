import { describe, it, expect } from 'vitest'
import { SPELLS_RT, SPELL_RT_BY_ID } from '@/data/spellsRt'
import { RT_SPELL_BY_WIZARD } from '@/data/rtLoadout'
import { WIZARDS } from '@/data/wizards'

const VERB_BY_ROLE = { Attaccante: ['danno'], Tank: ['scudo', 'protego'], Supporto: ['cura', 'carica', 'rianima'], Controllo: ['status'] } as const

describe('spell rt', () => {
  it('38 spell con id unici e verbo valido', () => {
    expect(SPELLS_RT.length).toBe(38)
    expect(new Set(SPELLS_RT.map(s => s.id)).size).toBe(38)
    for (const s of SPELLS_RT) expect(['danno', 'cura', 'scudo', 'status', 'carica', 'protego', 'rianima', 'buff']).toContain(s.verb)
  })
  it('danno ha potenza, cura ha cura, scudo ha scudo, status ha almeno un effetto', () => {
    for (const s of SPELLS_RT) {
      if (s.verb === 'danno') expect(s.potenza, s.id).toBeGreaterThan(0)
      if (s.verb === 'cura') expect(s.cura, s.id).toBeGreaterThan(0)
      if (s.verb === 'scudo') expect(s.scudo, s.id).toBeGreaterThan(0)
      if (s.verb === 'status') expect(!!(s.segno || s.gelo || s.unitStatus || s.teamStatus), s.id).toBe(true)
    }
  })
  it('circa un terzo Memoria senza cap, un terzo Crescendo, un terzo sicure', () => {
    const mem = SPELLS_RT.filter(s => s.crescita?.kind === 'memoria').length
    const cre = SPELLS_RT.filter(s => s.crescita?.kind === 'crescendo').length
    const none = SPELLS_RT.filter(s => !s.crescita).length
    expect(mem).toBeGreaterThanOrEqual(9); expect(cre).toBeGreaterThanOrEqual(8); expect(none).toBeGreaterThanOrEqual(9)
    expect(SPELLS_RT.filter(s => s.crescita?.kind === 'memoria' && s.crescita.cap === undefined).length).toBeGreaterThanOrEqual(7)
  })
})

describe('loadout rt (mago → spell)', () => {
  it('ogni mago ha una spell rt esistente e il verbo rispetta il ruolo', () => {
    for (const w of WIZARDS) {
      const id = RT_SPELL_BY_WIZARD[w.id]
      expect(id, w.id).toBeTruthy()
      const s = SPELL_RT_BY_ID[id!]
      expect(s, `${w.id} → ${id}`).toBeTruthy()
      expect(VERB_BY_ROLE[w.role] as readonly string[], `${w.id} (${w.role}) → ${s!.verb}`).toContain(s!.verb)
    }
    expect(Object.keys(RT_SPELL_BY_WIZARD).length).toBe(WIZARDS.length)
  })
  it('ogni casa: ≥2 applicatori del proprio Segno, ≥2 detonatori, ≥1 sostegno', () => {
    const SEGNO = { Grifondoro: ['fiamma'], Serpeverde: ['veleno'], Corvonero: ['scossa', 'gelo'], Tassorosso: ['scudo'] } as const
    for (const house of ['Grifondoro', 'Serpeverde', 'Corvonero', 'Tassorosso'] as const) {
      const spells = WIZARDS.filter(w => w.house === house).map(w => SPELL_RT_BY_ID[RT_SPELL_BY_WIZARD[w.id]!]!)
      const applies = (s: typeof spells[number]) => (SEGNO[house] as readonly string[]).some(k =>
        k === 'gelo' ? !!s.gelo : k === 'scudo' ? (!!s.scudo || s.verb === 'protego' || s.combo?.effect.kind === 'scudo') : s.segno?.kind === k)
      const detonator = (s: typeof spells[number]) => s.verb === 'danno' && !s.segno
      const support = (s: typeof spells[number]) => ['cura', 'carica', 'rianima'].includes(s.verb)
      expect(spells.filter(applies).length, `${house} applicatori`).toBeGreaterThanOrEqual(2)
      expect(spells.filter(detonator).length, `${house} detonatori`).toBeGreaterThanOrEqual(2)
      expect(spells.filter(support).length, `${house} sostegno`).toBeGreaterThanOrEqual(1)
    }
  })
})
