import { describe, it, expect } from 'vitest'
import { detectSynergies } from '@/game/engine/synergy'
import { WIZARDS } from '@/data/wizards'
import { SPELL_BY_ID } from '@/data/spells'
import { simulateBattle } from '@/game/engine/combat/simulate'
import { createRng } from '@/game/engine/rng'
import { RELICS } from '@/data/relics'
import type { ActiveRelic, ActiveSynergy, BattleResult, DraftedWizard } from '@/types'

function draft(id: string): DraftedWizard {
  const wizard = WIZARDS.find(w => w.id === id)!
  const stats = { hp: 100, atk: 30, def: 15, spd: 25 }
  return { wizard, stats, maxHp: 100, spell: SPELL_BY_ID['base_attack']! }
}

describe('Tossicità synergy', () => {
  it('activates with 3 veleno-tagged wizards', () => {
    const team = ['bellatrix', 'dolohov', 'slughorn'].map(draft)
    const ids = detectSynergies(team).map(a => a.synergy.id)
    expect(ids).toContain('tossicita')
  })
  it('does not activate with only 2', () => {
    const team = ['bellatrix', 'dolohov'].map(draft)
    const ids = detectSynergies(team).map(a => a.synergy.id)
    expect(ids).not.toContain('tossicita')
  })
})

import { applyStatus } from '@/game/engine/status'
import type { BattleUnit } from '@/types'

function mkUnit(maxHp = 100): BattleUnit {
  return { wizard: { id: 'd' }, side: 'right', hp: maxHp, maxHp, cooldowns: {}, statusEffects: [], alive: true } as unknown as BattleUnit
}

describe('veleno cap override', () => {
  it('caps at maxStacks(8) by default', () => {
    const u = mkUnit()
    for (let i = 0; i < 12; i++) applyStatus(u, 'veleno')
    expect(u.statusEffects.find(e => e.statusId === 'veleno')!.stacks).toBe(8)
  })
  it('ignores the cap when maxStacks override is Infinity', () => {
    const u = mkUnit()
    for (let i = 0; i < 12; i++) applyStatus(u, 'veleno', { maxStacks: Infinity })
    expect(u.statusEffects.find(e => e.statusId === 'veleno')!.stacks).toBe(12)
  })
})

function peakVelenoStacksOnRight(r: BattleResult): number {
  let peak = 0
  for (const snap of r.snapshots) {
    for (const [key, st] of Object.entries(snap)) {
      if (!key.startsWith('right:')) continue
      for (const e of st.statusEffects) {
        if (e.statusId === 'veleno') peak = Math.max(peak, e.stacks ?? 1)
      }
    }
  }
  return peak
}

describe('Tossicità battle integration', () => {
  const pugnale = RELICS.find(r => r.id === 'pugnale-bellatrix')!
  // 3 poison-tagged attackers vs one durable enemy so poison accrues many turns.
  const left = ['bellatrix', 'dolohov', 'blaise'].map(draft)
  const right = [(() => { const d = draft('greyback'); d.stats = { hp: 900, atk: 5, def: 10, spd: 1 }; d.maxHp = 900; return d })()]
  const relics: ActiveRelic[] = [{ relic: pugnale, stageObtained: 0 }]

  const run = (leftSyn: ActiveSynergy[]): BattleResult =>
    simulateBattle(left, right, createRng('veleno-syn-1'), { leftSyn, leftRelics: relics })

  it('caps at 8 without Tossicità', () => {
    const noSyn = run([])
    expect(peakVelenoStacksOnRight(noSyn)).toBe(8)
  })
  it('ramps past 8 with Tossicità active', () => {
    const withSyn = run(detectSynergies(left))   // left has 3 veleno tags → includes tossicita
    expect(peakVelenoStacksOnRight(withSyn)).toBeGreaterThan(8)
  })
})
