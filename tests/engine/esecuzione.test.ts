import { describe, it, expect } from 'vitest'
import { teamExecute } from '@/game/engine/execute'
import type { ActiveRelic, ActiveSynergy, DraftedWizard } from '@/types'

const team = [] as unknown as DraftedWizard[]
const spadaRelic: ActiveRelic = { relic: { id: 'spada-grifondoro', name: 'Spada', desc: '', rarity: 'rara', grantsExecute: { threshold: 0.3, bonus: 0.4 } }, stageObtained: 0 }
const spietatezza: ActiveSynergy = { synergy: { id: 'spietatezza', name: 'Spietatezza', kind: 'origin', requires: { tag: 'esecuzione', count: 3 }, bonus: { atk: 5 } }, memberIds: [] }

describe('teamExecute', () => {
  it('is undefined with no execute sources', () => {
    expect(teamExecute(team, [], [])).toBeUndefined()
  })
  it('a grantsExecute relic yields its threshold and bonus', () => {
    expect(teamExecute(team, [spadaRelic], [])).toEqual({ threshold: 0.3, bonus: 0.4 })
  })
  it('Spietatezza raises the threshold and adds bonus', () => {
    expect(teamExecute(team, [spadaRelic], [spietatezza])).toEqual({ threshold: 0.35, bonus: 0.65 })
  })
  it('Spietatezza alone (no relic) still grants execute', () => {
    expect(teamExecute(team, [], [spietatezza])).toEqual({ threshold: 0.35, bonus: 0.25 })
  })
})

import { simulateBattle } from '@/game/engine/combat/simulate'
import { createRng } from '@/game/engine/rng'
import { WIZARDS } from '@/data/wizards'
import { SPELL_BY_ID } from '@/data/spells'
import type { BattleResult, Stats } from '@/types'

function mk(id: string, stats: Stats): DraftedWizard {
  const wizard = WIZARDS.find(w => w.id === id)!
  return { wizard, stats, maxHp: stats.hp, spell: SPELL_BY_ID['base_attack']! }
}
const firstHitToRight = (r: BattleResult) =>
  r.log.find(e => e.targetSide === 'right' && (e.value ?? 0) > 0)?.value ?? 0

describe('execute applies to low-HP targets in battle', () => {
  const attacker = [mk('harry', { hp: 400, atk: 30, def: 10, spd: 30 })]
  const woundedEnemy = () => [{ ...mk('greyback', { hp: 400, atk: 1, def: 10, spd: 1 }), currentHp: 50 }] // 12.5% HP — below the 35% Spietatezza threshold
  const spietatezzaSyn: ActiveSynergy = { synergy: { id: 'spietatezza', name: 'Spietatezza', kind: 'origin', requires: { tag: 'esecuzione', count: 3 }, bonus: {} }, memberIds: [] }

  it('a Spietatezza team deals more damage to a wounded enemy than a plain team (same seed)', () => {
    const plain = simulateBattle(attacker, woundedEnemy(), createRng('exec-1'))
    const withExec = simulateBattle(attacker, woundedEnemy(), createRng('exec-1'), { leftSyn: [spietatezzaSyn] })
    expect(firstHitToRight(withExec)).toBeGreaterThan(firstHitToRight(plain))
  })
})

import { RELICS } from '@/data/relics'

describe('execute relics', () => {
  const spada = RELICS.find(r => r.id === 'spada-grifondoro')!
  const sigillo = RELICS.find(r => r.id === 'sigillo-carnefice')!
  const attacker = [mk('harry', { hp: 400, atk: 30, def: 10, spd: 30 })]
  // enemy starts at 12.5% HP (< the 0.30 Spada threshold) so the FIRST hit executes.
  const woundedEnemy = () => [{ ...mk('greyback', { hp: 400, atk: 1, def: 10, spd: 1 }), currentHp: 50 }]

  it('Spada grants execute (bigger first hit on a wounded enemy than no relic, same seed)', () => {
    const plain = simulateBattle(attacker, woundedEnemy(), createRng('exec-2'))
    const withSpada = simulateBattle(attacker, woundedEnemy(), createRng('exec-2'), { leftRelics: [{ relic: spada, stageObtained: 0 }] })
    expect(firstHitToRight(withSpada)).toBeGreaterThan(firstHitToRight(plain))
  })
  it('Sigillo scales Spada (bigger first hit than Spada alone)', () => {
    const a = simulateBattle(attacker, woundedEnemy(), createRng('exec-3'), { leftRelics: [{ relic: spada, stageObtained: 0 }] })
    const b = simulateBattle(attacker, woundedEnemy(), createRng('exec-3'), { leftRelics: [{ relic: spada, stageObtained: 0 }, { relic: sigillo, stageObtained: 0 }] })
    expect(firstHitToRight(b)).toBeGreaterThan(firstHitToRight(a))
  })
})

import { detectSynergies } from '@/game/engine/synergy'

describe('Spietatezza synergy', () => {
  it('activates with 3 esecuzione-tagged wizards', () => {
    const t = ['voldemort', 'lucius', 'harry'].map(id => mk(id, { hp: 100, atk: 30, def: 10, spd: 20 }))
    expect(detectSynergies(t).map(a => a.synergy.id)).toContain('spietatezza')
  })
  it('does not activate with only 2', () => {
    const t = ['voldemort', 'lucius'].map(id => mk(id, { hp: 100, atk: 30, def: 10, spd: 20 }))
    expect(detectSynergies(t).map(a => a.synergy.id)).not.toContain('spietatezza')
  })
})
