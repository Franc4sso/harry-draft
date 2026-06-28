import { describe, it, expect } from 'vitest'
import type { BattleUnit } from '@/types'
import { applyStatus, tickStatuses } from '@/game/engine/status'
import { keywordDamageMult } from '@/game/engine/relics'
import type { ActiveRelic, BattleResult, DraftedWizard } from '@/types'
import { simulateBattle } from '@/game/engine/combat/simulate'
import { createRng } from '@/game/engine/rng'
import { RELICS } from '@/data/relics'
import { WIZARDS } from '@/data/wizards'
import { SPELL_BY_ID } from '@/data/spells'

/** Minimal BattleUnit with only the fields tickStatuses/applyStatus read. */
function mkUnit(maxHp = 100): BattleUnit {
  return {
    wizard: { id: 'dummy' },
    side: 'right',
    hp: maxHp,
    maxHp,
    cooldowns: {},
    statusEffects: [],
    alive: true,
  } as unknown as BattleUnit
}

describe('veleno: accumulate stack policy', () => {
  it('grows a single entry up to maxStacks, then caps', () => {
    const u = mkUnit()
    for (let i = 0; i < 12; i++) applyStatus(u, 'veleno')
    const entries = u.statusEffects.filter(e => e.statusId === 'veleno')
    expect(entries).toHaveLength(1)          // one entry, not many
    expect(entries[0]!.stacks).toBe(8)       // capped at maxStacks
  })

  it('refreshes remaining duration on reapply', () => {
    const u = mkUnit()
    applyStatus(u, 'veleno')
    const e = u.statusEffects.find(x => x.statusId === 'veleno')!
    e.remaining = 1
    applyStatus(u, 'veleno')
    expect(e.remaining).toBe(2)              // refreshed to defaultDuration
    expect(e.stacks).toBe(2)
  })
})

describe('veleno: "che divora" tick (no mult yet)', () => {
  it('deals stacks*flat + min(stacks,8)*0.5%maxHp', () => {
    const u = mkUnit(200)
    for (let i = 0; i < 5; i++) applyStatus(u, 'veleno')   // 5 stacks
    const before = u.hp
    tickStatuses(1, u)
    // flat 5*4=20 ; pct min(5,8)*0.005*200=5 ; total 25
    expect(before - u.hp).toBe(25)
  })

  it('caps the %maxHp component at 8 stacks but not the flat', () => {
    const u = mkUnit(1000)
    for (let i = 0; i < 12; i++) applyStatus(u, 'veleno')  // stacks cap at 8
    const before = u.hp
    tickStatuses(1, u)
    // stacks=8 ; flat 8*4=32 ; pct min(8,8)*0.005*1000=40 ; total 72
    expect(before - u.hp).toBe(72)
  })

  it('does not route through shields (bypasses absorb)', () => {
    const u = mkUnit(100)
    u.statusEffects.push({ kind: 'shield', statusId: 'shield', remaining: 3, stacks: 1, absorbLeft: 50 })
    applyStatus(u, 'veleno')                                // 1 stack
    const before = u.hp
    tickStatuses(1, u)
    // flat 1*4=4 ; pct 1*0.005*100=0.5 ; round(4.5)=5 ; shield untouched
    expect(before - u.hp).toBe(5)
    expect(u.statusEffects.find(e => e.statusId === 'shield')!.absorbLeft).toBe(50)
  })
})

describe('keywordDamageMult', () => {
  const team = [] as unknown as DraftedWizard[]
  it('returns 1 with no relics', () => {
    expect(keywordDamageMult(team, [], 'veleno')).toBe(1)
  })
  it('sums keywordMult from unconditional relics', () => {
    const relics: ActiveRelic[] = [
      { relic: { id: 'a', name: 'A', desc: '', rarity: 'non-comune', keywordMult: { veleno: 0.5 } }, stageObtained: 0 },
    ]
    expect(keywordDamageMult(team, relics, 'veleno')).toBeCloseTo(1.5)
  })
})

describe('veleno: velenoMult scales the flat component only', () => {
  it('1.5x mult scales flat but not %maxHp', () => {
    const u = mkUnit(200)
    for (let i = 0; i < 5; i++) applyStatus(u, 'veleno')   // 5 stacks
    const before = u.hp
    tickStatuses(1, u, { velenoMult: 1.5 })
    // flat 5*4*1.5=30 ; pct 5*0.005*200=5 ; total 35
    expect(before - u.hp).toBe(35)
  })
})

function draft(id: string, over: Partial<{ hp: number; atk: number; def: number; spd: number }> = {}): DraftedWizard {
  const wizard = WIZARDS.find(w => w.id === id)!
  const stats = { hp: over.hp ?? 200, atk: over.atk ?? 40, def: over.def ?? 20, spd: over.spd ?? 30 }
  return { wizard, stats, maxHp: stats.hp, spell: SPELL_BY_ID['base_attack']! }
}

function firstDotOnRight(r: BattleResult): number {
  const e = r.log.find(x => x.flags.includes('dot') && x.targetSide === 'right')
  return e?.value ?? 0
}

describe('veleno relics: Ampolla scales the in-battle poison tick', () => {
  const pugnale = RELICS.find(r => r.id === 'pugnale-bellatrix')!   // 100% onHit → veleno
  const ampolla = RELICS.find(r => r.id === 'ampolla-veleno')!      // +50% veleno flat
  const left = [draft('harry', { atk: 40, hp: 500 })]               // attacker, won't die
  const right = [draft('ron', { hp: 300, def: 20 })]                // soaks several turns

  const run = (leftRelics: ActiveRelic[]): BattleResult =>
    simulateBattle(left, right, createRng('veleno-int-1'), { leftRelics })

  it('applies poison via the relic onHit trigger', () => {
    expect(firstDotOnRight(run([{ relic: pugnale, stageObtained: 0 }]))).toBeGreaterThan(0)
  })

  it('Ampolla makes the first poison tick stronger (flat x1.5), same seed', () => {
    const without = run([{ relic: pugnale, stageObtained: 0 }])
    const withAmpolla = run([{ relic: pugnale, stageObtained: 0 }, { relic: ampolla, stageObtained: 0 }])
    expect(firstDotOnRight(withAmpolla)).toBeGreaterThan(firstDotOnRight(without))
  })
})
