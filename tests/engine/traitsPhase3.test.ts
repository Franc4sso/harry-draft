import { describe, it, expect } from 'vitest'
import { TRAIT_BY_ID } from '@/data/traits'
import type { BattleUnit, HookCtx, EffectSpec } from '@/types'

const STUB_SPELL = { id: 'stub', name: 'Stub', desc: '', type: 'Attacco' as const, hitChance: 1 }

function u(hp = 100, maxHp = 100): BattleUnit {
  const stats = { hp: 100, atk: 30, def: 20, spd: 25 }
  return { wizard: { id: 'u', name: 'u', house: 'Grifondoro', role: 'Attaccante', tier: 3,
    ranges: { hp: [100,100], atk: [30,30], def: [20,20], spd: [25,25] }, spellPool: [] },
    stats, maxHp, hp, spell: STUB_SPELL, side: 'left', cooldowns: {}, statusEffects: [], buffedStats: stats, alive: true } as BattleUnit
}

const ctx = (): HookCtx => ({ turn: 1, actor: u(), target: u(), side: 'left', flags: [] })

/** Pull the EffectSpec list off a reactive trait, asserting it is reactive. */
function reactiveEffects(id: string): EffectSpec[] {
  const t = TRAIT_BY_ID[id]!.trigger
  if (t.kind !== 'reactive') throw new Error(`${id} expected reactive`)
  return t.effects(ctx())
}

describe('Phase 3 control-on-hit traits', () => {
  it('Pietrificazione applies a chance-gated stun to the enemy on hit', () => {
    const t = TRAIT_BY_ID['pietrificazione']!.trigger
    expect(t.kind).toBe('reactive')
    if (t.kind !== 'reactive') return
    expect(t.hook).toBe('onHit')
    expect(t.owner).toBe('actor')
    const [eff] = t.effects(ctx())
    expect(eff).toMatchObject({ kind: 'applyStatus', target: 'enemy', statusId: 'stun' })
    if (eff.kind === 'applyStatus') {
      expect(eff.chance).toBeGreaterThan(0)
      expect(eff.chance).toBeLessThan(0.5)
    }
  })

  it('Bavaglio applies a chance-gated silence to the enemy on hit', () => {
    const [eff] = reactiveEffects('bavaglio')
    expect(eff).toMatchObject({ kind: 'applyStatus', target: 'enemy', statusId: 'silence' })
    if (eff.kind === 'applyStatus') expect(eff.chance).toBeGreaterThan(0)
  })

  it('Disarmo applies a chance-gated disarm to the enemy on hit', () => {
    const [eff] = reactiveEffects('disarmo')
    expect(eff).toMatchObject({ kind: 'applyStatus', target: 'enemy', statusId: 'disarm' })
    if (eff.kind === 'applyStatus') expect(eff.chance).toBeGreaterThan(0)
  })
})

describe('Phase 3 dot + slow traits', () => {
  it('Veleno applies a burn (dot) to the enemy on hit', () => {
    const [eff] = reactiveEffects('veleno')
    expect(eff).toMatchObject({ kind: 'applyStatus', target: 'enemy', statusId: 'burn' })
    if (eff.kind === 'applyStatus') expect(eff.chance).toBeGreaterThan(0.18)
  })

  it('Logoramento applies a slow (spd debuff) to the enemy on hit', () => {
    const [eff] = reactiveEffects('logoramento')
    expect(eff).toMatchObject({ kind: 'applyStatus', target: 'enemy', statusId: 'slow' })
    if (eff.kind === 'applyStatus') expect(eff.chance).toBeGreaterThan(0.18)
  })
})
