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
const totalDmgToRight = (r: BattleResult) =>
  r.log.filter(e => e.targetSide === 'right' && (e.value ?? 0) > 0).reduce((s, e) => s + (e.value ?? 0), 0)

describe('execute applies to low-HP targets in battle', () => {
  const attacker = [mk('harry', { hp: 400, atk: 30, def: 10, spd: 30 })]
  const woundedEnemy = () => [{ ...mk('greyback', { hp: 400, atk: 1, def: 10, spd: 1 }), currentHp: 50 }] // 12.5% HP — below the 35% Spietatezza threshold
  const spietatezzaSyn: ActiveSynergy = { synergy: { id: 'spietatezza', name: 'Spietatezza', kind: 'origin', requires: { tag: 'esecuzione', count: 3 }, bonus: { atk: 5 } }, memberIds: [] }

  it('a Spietatezza team deals more damage to a wounded enemy than a plain team (same seed)', () => {
    const plain = simulateBattle(attacker, woundedEnemy(), createRng('exec-1'))
    const withExec = simulateBattle(attacker, woundedEnemy(), createRng('exec-1'), { leftSyn: [spietatezzaSyn] })
    expect(totalDmgToRight(withExec)).toBeGreaterThan(totalDmgToRight(plain))
  })
})
