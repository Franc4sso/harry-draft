import { describe, it, expect } from 'vitest'
import { SPELLS_RT, SPELL_RT_BY_ID } from '@/data/spellsRt'
import { RT_SPELL_BY_WIZARD } from '@/data/rtLoadout'
import { WIZARDS, WIZARD_BY_ID } from '@/data/wizards'
import { ABILITIES, ABILITY_BY_ID, GRIFONDORO, SERPEVERDE, CORVONERO, TASSOROSSO } from '@/data/abilities'
import type { Ability, AbilityLine } from '@/types/rt'

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

const CONTINUO_TARGET_VIETATI = new Set(['opposto', 'nemicoCasuale', 'adiacenteDelBersaglio'])
function checkLine(a: Ability, l: AbilityLine, where: string) {
  const w = `${a.id} ${where}`
  if (l.trigger === 'lancio') {
    const ok = (l.limit?.everySeconds ?? 0) > 0 || (l.limit?.perBattle ?? 0) > 0 || l.limit?.senzaCooldown === true
    expect(ok, `${w}: ogni riga 'lancio' ha cooldown, perBattle o senzaCooldown`).toBe(true)
  }
  if (l.trigger === 'continuo') {
    expect(CONTINUO_TARGET_VIETATI.has(l.target), `${w}: continuo con bersaglio ${l.target}`).toBe(false)
    expect(['dannoPct', 'cdPct', 'cdFlat', 'hpPct', 'scudoIniziale', 'immune', 'copre', 'durataStatusPct'], `${w}: effetto continuo ${l.effect.kind}`).toContain(l.effect.kind)
  }
  if (l.trigger === 'lancio' || l.trigger === 'inizio' || l.trigger === 'ogniSecondi' || l.trigger === 'sottoSoglia') {
    expect(l.target !== 'adiacenteDelBersaglio' && !(l.cond && 'bersaglio' in l.cond), `${w}: nessun bersaglio nel contesto`).toBe(true)
  }
  if (l.trigger === 'ogniSecondi') expect((l.limit?.everySeconds ?? 0) > 0, `${w}: ogniSecondi senza everySeconds`).toBe(true)
  if (l.trigger === 'sottoSoglia') expect(l.cond && 'hpPropriaSotto' in l.cond, `${w}: sottoSoglia senza hpPropriaSotto`).toBe(true)
  if (l.params) { expect(l.params.length).toBe(3); expect(l.params[0] <= l.params[1] && l.params[1] <= l.params[2] || l.params[0] >= l.params[1] && l.params[1] >= l.params[2], `${w}: params monotoni`).toBe(true) }
  if (l.target === 'alleatiTag' || l.target === 'alleatiCasa' || l.target === 'alleatiRuolo') expect(l.targetArg, `${w}: targetArg`).toBeTruthy()
}

describe('abilità: regole generali', () => {
  it('ogni abilità: id = wizard, lv4 presente, righe valide', () => {
    for (const a of ABILITIES) {
      expect(WIZARD_BY_ID[a.id], a.id).toBeTruthy()
      expect(a.lv4, `${a.id} lv4`).toBeTruthy()
      a.lines.forEach((l, i) => checkLine(a, l, `#${i}`))
      checkLine(a, a.lv4!, 'lv4')
    }
  })
  it('budget per rarità (§5.0): righe lv1 senza contare "vittoria"', () => {
    // Una cond "strutturale" non conta: la soglia di un KO (spec: i KO hanno sempre soglia) e l'hpPropriaSotto di una sottoSoglia.
    const contaCond = (l: AbilityLine) => !!l.cond && !(l.effect.kind === 'ko' && 'hpNemicaSotto' in l.cond) && l.trigger !== 'sottoSoglia'
    for (const a of ABILITIES) {
      const tier = WIZARD_BY_ID[a.id]!.tier
      const lines = a.lines.filter(l => l.trigger !== 'vittoria')
      if (tier === 1 || tier === 2) { expect(lines.length, a.id).toBe(2); expect(lines.filter(contaCond).length, `${a.id}: T${tier} al più una cond`).toBeLessThanOrEqual(1) }
      if (tier === 3) { expect(lines.length, a.id).toBeGreaterThanOrEqual(1); expect(lines.length, a.id).toBeLessThanOrEqual(2); if (lines.length === 2) expect(contaCond(lines[1]!), `${a.id}: T3 seconda riga condizionata`).toBe(true) }
      if (tier === 4) expect(lines.length, a.id).toBe(1)
    }
  })
})

describe('abilità: catalogo', () => {
  it('60 abilità, una per mago, nessun mago senza', () => {
    expect(ABILITIES.length).toBe(WIZARDS.length)
    for (const w of WIZARDS) expect(ABILITY_BY_ID[w.id], w.id).toBeTruthy()
  })
  it('la casa di ogni abilità coincide con il file (Grifondoro in grifondoro.ts, ecc.)', () => {
    for (const [house, list] of [['Grifondoro', GRIFONDORO], ['Serpeverde', SERPEVERDE], ['Corvonero', CORVONERO], ['Tassorosso', TASSOROSSO]] as const)
      for (const a of list) expect(WIZARD_BY_ID[a.id]!.house, a.id).toBe(house)
  })
  it('varietà: almeno 8 ultimate (perBattle), almeno 6 righe libere, almeno 10 Continuo, almeno 6 sottoSoglia/koSubito', () => {
    const all = ABILITIES.flatMap(a => [...a.lines, a.lv4!])
    expect(all.filter(l => l.limit?.perBattle).length).toBeGreaterThanOrEqual(8)
    expect(all.filter(l => l.limit?.senzaCooldown).length).toBeGreaterThanOrEqual(6)
    expect(all.filter(l => l.trigger === 'continuo').length).toBeGreaterThanOrEqual(10)
    expect(all.filter(l => l.trigger === 'sottoSoglia' || l.trigger === 'koSubito').length).toBeGreaterThanOrEqual(6)
  })
  it('i riferimenti a maghi/tag/case esistono', () => {
    const tags = new Set(WIZARDS.flatMap(w => w.tags ?? []))
    for (const a of ABILITIES) for (const l of [...a.lines, a.lv4!]) {
      if (l.target === 'alleatiTag') expect(tags.has(l.targetArg!), `${a.id}: tag ${l.targetArg}`).toBe(true)
      if (l.target === 'alleatiCasa') expect(['Grifondoro', 'Serpeverde', 'Corvonero', 'Tassorosso']).toContain(l.targetArg)
      const c = l.cond as Record<string, unknown> | undefined
      const ref = (c?.adiacente ?? c?.inSquadra) as { wizardId?: string; tag?: string } | undefined
      if (ref?.wizardId) expect(WIZARD_BY_ID[ref.wizardId], `${a.id}: ${ref.wizardId}`).toBeTruthy()
      if (ref?.tag) expect(tags.has(ref.tag), `${a.id}: tag ${ref.tag}`).toBe(true)
      if (l.effect.kind === 'copre') expect(WIZARD_BY_ID[l.effect.wizardId], `${a.id}: copre ${l.effect.wizardId}`).toBeTruthy()
    }
  })
})
