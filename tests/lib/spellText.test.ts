import { describe, it, expect } from 'vitest'
import { spellHeadline, spellVerb, spellAccuracy, spellCadence } from '@/lib/spellText'
import { SPELL_BY_ID } from '@/data/spells'

const spell = (id: string) => SPELL_BY_ID[id]!

describe('spellHeadline — il numero che apre la riga', () => {
  it('un attacco mostra il moltiplicatore di danno', () => {
    expect(spellHeadline(spell('bombarda'))).toEqual({ value: '×2', unit: 'danni' })
  })
  it('una cura mostra i punti vita', () => {
    expect(spellHeadline(spell('vulnera'))).toEqual({ value: '+48', unit: 'vita' })
  })
  it('un debuff di statistica mostra la statistica toccata', () => {
    expect(spellHeadline(spell('confundo'))).toEqual({ value: '−15', unit: 'vel' })
  })
  it('un controllo puro mostra la durata', () => {
    expect(spellHeadline(spell('petrificus'))).toEqual({ value: '1', unit: 'turno' })
  })
})

describe('spellVerb — cosa fa, senza gergo', () => {
  it('non dice mai "permanente, cumulativo"', () => {
    for (const s of Object.values(SPELL_BY_ID)) {
      expect(spellVerb(s)).not.toMatch(/permanente|cumulativo/i)
    }
  })
  it('non contiene mai parentesi annidate', () => {
    for (const s of Object.values(SPELL_BY_ID)) {
      expect(spellVerb(s)).not.toMatch(/\(.*\(/)
    }
  })
  // I test qui sopra girano su TUTTE le magie reali, ma per le magie di solo danno
  // `spellVerb` ripiega sulla `desc` scritta a mano: oggi nessuna contiene gergo,
  // quindi passerebbero anche senza alcun filtro. Questi due casi provano che la
  // rete di sicurezza esiste davvero, invece di dipendere dalla disciplina di chi
  // scrive i contenuti. (Difetto segnalato in review, 2026-09-15.)
  it('ripulisce il gergo anche da una desc scritta a mano', () => {
    const fake = { ...spell('bombarda'), desc: 'Esplode (permanente, cumulativo) forte.' }
    expect(spellVerb(fake)).toBe('Esplode forte.')
  })
  it('corregge la concordanza anche da una desc scritta a mano', () => {
    const fake = { ...spell('bombarda'), desc: 'Stordisce per 1 turni.' }
    expect(spellVerb(fake)).toBe('Stordisce per 1 turno.')
  })

  it('usa "resta" per gli effetti permanenti', () => {
    expect(spellVerb(spell('confundo'))).toContain('resta')
  })
  it('concorda il singolare: mai "1 turni"', () => {
    for (const s of Object.values(SPELL_BY_ID)) {
      expect(spellVerb(s)).not.toMatch(/\b1 turni\b/)
    }
  })
})

describe('spellAccuracy e spellCadence', () => {
  it('la precisione è una percentuale intera', () => {
    expect(spellAccuracy(spell('confundo'))).toEqual({ pct: 90, label: '90%' })
  })
  it('una cura che non può mancare dice "sempre"', () => {
    expect(spellAccuracy(spell('vulnera')).label).toBe('sempre')
  })
  it('ricarica 1 significa "ogni 2 turni"', () => {
    expect(spellCadence(spell('confundo'))).toEqual({ turns: 2, label: 'ogni 2 turni' })
  })
  it('ricarica 0 significa "ogni turno"', () => {
    expect(spellCadence(spell('expelliarmus'))).toEqual({ turns: 1, label: 'ogni turno' })
  })
})
