import { describe, it, expect } from 'vitest'
import { tickStatuses, applyStatus } from '@/game/engine/status'
import { toBattleUnits, simulateBattle } from '@/game/engine/combat/simulate'
import { resolveAction } from '@/game/engine/combat/resolve'
import { createRng } from '@/game/engine/rng'
import { SPELL_BY_ID } from '@/data/spells'
import type { ActiveRelic, BattleUnit, DraftedWizard, Wizard } from '@/types'

function unit(id: string, spellId: string, over: Partial<BattleUnit> = {}): BattleUnit {
  const stats = { hp: 120, atk: 80, def: 30, spd: 40 }
  const dw: DraftedWizard = {
    wizard: { id, name: id, house: 'Grifondoro', role: 'Attaccante', tier: 3,
      gender: 'm' as const, ranges: { hp: [120, 120], atk: [80, 80], def: [30, 30], spd: [40, 40] }, spellPool: [spellId] },
    stats, maxHp: 120, spell: SPELL_BY_ID[spellId]!,
  }
  return { ...dw, side: 'left', hp: 120, cooldowns: {}, statusEffects: [], buffedStats: stats, alive: true, ...over }
}

function dw(id: string, spellId: string, over: Partial<DraftedWizard> = {}): DraftedWizard {
  const stats = { hp: 120, atk: 10, def: 10, spd: 40 }
  const wizard = { id, name: id, house: 'Grifondoro', role: 'Attaccante', tier: 3,
    gender: 'm' as const, ranges: { hp: [120, 120], atk: [10, 10], def: [10, 10], spd: [40, 40] }, spellPool: [spellId] } as unknown as Wizard
  return { wizard, stats, maxHp: 120, spell: SPELL_BY_ID[spellId]!, ...over }
}

describe('Corrotto in battaglia', () => {
  it('tickHeal (status regen) NON cura un corrotto', () => {
    const corrotto = unit('a', 'base_attack', { hp: 50, maxHp: 120, corrotto: true })
    applyStatus(corrotto, 'regen') // tickHeal: 12

    const sano = unit('b', 'base_attack', { hp: 50, maxHp: 120 })
    applyStatus(sano, 'regen')

    tickStatuses(1, corrotto)
    tickStatuses(1, sano)

    expect(corrotto.hp).toBe(50) // invariato: il corrotto non riceve mai il tick di regen
    expect(sano.hp).toBe(62) // 50 + 12
  })

  it('team regen di fine turno NON cura un corrotto (simulate.ts)', () => {
    // Reliquia regen +8 a tutta la squadra a fine turno (simulate.ts ~426).
    // Team sinistro: un corrotto ferito + un sano ferito, entrambi Supporto senza
    // bersagli di cura utili (base_attack) così l'unico Cura in log è il team-regen.
    const corrottoWiz = dw('corrotto1', 'base_attack', { currentHp: 40, corrotto: true })
    const sanoWiz = dw('sano1', 'base_attack', { currentHp: 40 })
    const nemico = dw('nemico1', 'base_attack')

    // reliquia regen inline (bezoar rimossa nella pulizia pool 2026-07-22)
    const relics: ActiveRelic[] = [{ relic: { id: 'test-regen', name: 'Test Regen', desc: '', rarity: 'comune', bonus: { regen: 8 } }, stageObtained: 0 }]

    const result = simulateBattle([corrottoWiz, sanoWiz], [nemico], createRng(1), {
      leftRelics: relics,
    })

    const curaCorrotto = result.log.filter(e => e.type === 'Cura' && e.targetId === 'corrotto1')
    const curaSano = result.log.filter(e => e.type === 'Cura' && e.targetId === 'sano1')

    expect(curaCorrotto.length).toBe(0) // mai una riga di cura sul corrotto
    expect(curaSano.length).toBeGreaterThan(0) // il sano riceve il team-regen
  })

  it('magia Cura su corrotto vale 0 (heal handler)', () => {
    const actor = unit('healer', 'episkey', { side: 'left' })
    const corrottoTarget = unit('a', 'base_attack', { side: 'left', hp: 50, maxHp: 120, corrotto: true })

    const entry = resolveAction(createRng(1), 1, actor, corrottoTarget, SPELL_BY_ID['episkey']!, [actor, corrottoTarget])

    expect(entry.value ?? 0).toBe(0)
    expect(corrottoTarget.hp).toBe(50) // invariato
  })

  it('il targeting delle cure salta i corrotti (mostWounded)', () => {
    // End-to-end: un Supporto con episkey (Cura) deve scegliere l'alleato ferito lieve,
    // MAI il corrotto ferito gravissimo, anche se quest'ultimo è il candidato "più ferito".
    // spd forzate: nemico attacca al turno 1 (rompe il primo alleato in modo irrilevante),
    // healer spd altissima cura al turno 1 prima di chiunque altro tra gli alleati.
    const corrottoWiz = dw('corrotto1', 'base_attack', {
      currentHp: 5, corrotto: true, stats: { hp: 120, atk: 10, def: 10, spd: 10 },
    })
    const lieveWiz = dw('lieve1', 'base_attack', {
      currentHp: 110, stats: { hp: 120, atk: 10, def: 10, spd: 10 },
    })
    const healerWiz: DraftedWizard = {
      wizard: { id: 'healer1', name: 'healer1', house: 'Grifondoro', role: 'Supporto', tier: 3,
        gender: 'm' as const, ranges: { hp: [120, 120], atk: [10, 10], def: [10, 10], spd: [999, 999] }, spellPool: ['episkey'] } as unknown as Wizard,
      stats: { hp: 120, atk: 10, def: 10, spd: 999 }, maxHp: 120, spell: SPELL_BY_ID['episkey']!,
    }
    const nemico = dw('nemico1', 'base_attack', { stats: { hp: 120, atk: 1, def: 10, spd: 1 } })

    const result = simulateBattle([corrottoWiz, lieveWiz, healerWiz], [nemico], createRng(1))

    const curaLog = result.log.filter(e => e.action === 'Episkey' && e.actorId === 'healer1')
    expect(curaLog.length).toBeGreaterThan(0)
    // First heal must land on the lightly-wounded ally, never on the corrupted unit — even
    // though the corrupted unit is far more wounded (5/120 vs 110/120). Once lieve1 tops off,
    // mostWounded finds no further eligible candidate and the spell fizzles onto the healer
    // itself (0 value) — that fallback is expected and NOT a violation of the gate.
    expect(curaLog[0]!.targetId).toBe('lieve1')
    expect(curaLog.some(e => e.targetId === 'corrotto1')).toBe(false)
  })
})
