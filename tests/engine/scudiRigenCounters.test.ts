import { describe, it, expect } from 'vitest'
import { simulateBattle } from '@/game/engine/combat/simulate'
import { createRng } from '@/game/engine/rng'
import { RELICS } from '@/data/relics'
import { WIZARDS } from '@/data/wizards'
import { SPELL_BY_ID } from '@/data/spells'
import type { ActiveRelic, ActiveSynergy, DraftedWizard, Stats } from '@/types'

const egida = RELICS.find(r => r.id === 'egida-tassorosso')!
const cuore = RELICS.find(r => r.id === 'cuore-del-tasso')!
const spada = RELICS.find(r => r.id === 'spada-grifondoro')!
const sigillo = RELICS.find(r => r.id === 'sigillo-carnefice')!

const mk = (id: string, stats: Stats): DraftedWizard => ({ wizard: WIZARDS.find(w => w.id === id)!, stats, maxHp: stats.hp, spell: SPELL_BY_ID['base_attack']! })
// A controlled high-regen synergy so the wall actually overflows each tick (kept off the roster).
const regenSyn = (amount: number): ActiveSynergy => ({ synergy: { id: 'test-regen', name: 'Test Regen', kind: 'group', requires: { count: 1 }, bonus: { regen: amount } }, memberIds: [] })
const convert: ActiveRelic[] = [{ relic: egida, stageObtained: 0 }, { relic: cuore, stageObtained: 0 }]
const execRelics: ActiveRelic[] = [{ relic: spada, stageObtained: 0 }, { relic: sigillo, stageObtained: 0 }]

describe('Scudi-Rigen counter-web', () => {
  // The wall: moderate HP + low def so chip outpaces regen without shields,
  // but overflow→shield (rate 0.75 with egida+cuore) absorbs the net chip.
  // Tuned stats: wallHp=200, wallDef=12, attrAtk=65, regen=60, seed='seed4'.
  const wall = () => [mk('ernie', { hp: 200, atk: 16, def: 12, spd: 14 })]

  it('BEATS an attrition enemy (overflow→shield out-sustains chip damage)', () => {
    const attrition = [mk('cedric', { hp: 300, atk: 65, def: 16, spd: 16 })]
    const plain = simulateBattle(wall(), attrition, createRng('seed4'), { leftSyn: [regenSyn(60)] })
    const withConvert = simulateBattle(wall(), attrition, createRng('seed4'), { leftSyn: [regenSyn(60)], leftRelics: convert })
    expect(plain.winner).toBe('right')        // baseline: chip out-damages a non-converting wall
    expect(withConvert.winner).toBe('left')   // conversion flips it — shield absorbs the chip
  })

  it('LOSES to Esecuzione (the finisher closes it under threshold)', () => {
    const finisher = [mk('harry', { hp: 300, atk: 60, def: 16, spd: 30 })]
    const r = simulateBattle(wall(), finisher, createRng('sr-exec'), { leftSyn: [regenSyn(60)], leftRelics: convert, rightRelics: execRelics })
    expect(r.winner).toBe('right')
  })

  it('LOSES to Burst (one big hit blows through the shield)', () => {
    const burst = [mk('voldemort', { hp: 300, atk: 400, def: 20, spd: 99 })]
    const r = simulateBattle(wall(), burst, createRng('sr-burst'), { leftSyn: [regenSyn(60)], leftRelics: convert })
    expect(r.winner).toBe('right')
  })
})
