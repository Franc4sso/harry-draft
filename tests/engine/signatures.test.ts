import { describe, it, expect } from 'vitest'
import type { BattleUnit, Signature, Wizard } from '@/types'
import { createEventBus } from '@/game/engine/combat/eventBus'
import { registerSignatures } from '@/game/engine/signatures'

function unit(id: string, over: Partial<BattleUnit> = {}): BattleUnit {
  const wizard = { id, name: id, house: 'Grifondoro', role: 'Attaccante', tier: 3, gender: 'm' as const, ranges: { hp: [1, 1], atk: [1, 1], def: [1, 1], spd: [1, 1] }, spellPool: [] } as Wizard
  const stats = { hp: 100, atk: 20, def: 10, spd: 20 }
  return {
    wizard, stats, maxHp: 100, spell: { id: 's', name: 's', desc: '', type: 'Attacco', hitChance: 1 },
    side: 'left', hp: 100, cooldowns: {}, statusEffects: [], buffedStats: stats, alive: true, ...over,
  }
}

describe('registerSignatures', () => {
  it('applies a modifier only to the owning unit', () => {
    const bus = createEventBus()
    const owner = unit('a')
    const other = unit('b')
    const catalog: Record<string, Signature> = {
      a: { id: 'a', name: 'A', desc: '', triggers: [{ kind: 'modifier', hook: 'modifyOutgoingDamage', owner: 'actor', apply: (v) => v * 2 }] },
    }
    registerSignatures(bus, [owner, other], catalog)
    expect(bus.emitModifier('modifyOutgoingDamage', 10, { turn: 1, actor: owner, side: 'left', flags: [] })).toBe(20)
    expect(bus.emitModifier('modifyOutgoingDamage', 10, { turn: 1, actor: other, side: 'left', flags: [] })).toBe(10)
  })

  it('collects reactive effects only for the owning unit', () => {
    const bus = createEventBus()
    const owner = unit('a')
    const other = unit('b')
    const catalog: Record<string, Signature> = {
      a: { id: 'a', name: 'A', desc: '', triggers: [{ kind: 'reactive', hook: 'onTurnStart', owner: 'actor', effects: () => [{ kind: 'shield', amount: 5 }] }] },
    }
    registerSignatures(bus, [owner, other], catalog)
    expect(bus.collectReactive('onTurnStart', { turn: 1, actor: owner, side: 'left', flags: [] })).toHaveLength(1)
    expect(bus.collectReactive('onTurnStart', { turn: 1, actor: other, side: 'left', flags: [] })).toHaveLength(0)
  })

  it('registers every trigger of a multi-trigger signature', () => {
    const bus = createEventBus()
    const owner = unit('a')
    const catalog: Record<string, Signature> = {
      a: { id: 'a', name: 'A', desc: '', triggers: [
        { kind: 'modifier', hook: 'modifyOutgoingDamage', owner: 'actor', apply: (v) => v + 1 },
        { kind: 'reactive', hook: 'onHit', owner: 'actor', effects: () => [{ kind: 'applyStatus', target: 'enemy', statusId: 'stun' }] },
      ] },
    }
    registerSignatures(bus, [owner], catalog)
    expect(bus.emitModifier('modifyOutgoingDamage', 10, { turn: 1, actor: owner, side: 'left', flags: [] })).toBe(11)
    expect(bus.collectReactive('onHit', { turn: 1, actor: owner, target: owner, side: 'left', flags: [] })).toHaveLength(1)
  })
})

import { SIGNATURES, SIGNATURE_BY_ID } from '@/data/signatures'
import { WIZARDS } from '@/data/wizards'
import { STATUS_BY_ID } from '@/data/statuses'
import type { HookCtx } from '@/types'

describe('signature catalog integrity', () => {
  // Onda 1.d (2026-07-27): il catalogo NON e' piu' "una firma per mago" — e' stato potato
  // a 15 firme su 60 maghi (spec: docs/superpowers/specs/2026-07-27-onda-1d-potare-le-firme.md).
  // L'invariante che resta e' piu' debole ma e' quello vero: nessuna firma orfana, e al
  // massimo una per mago. Il conteggio esatto e la lista dei 15 sono in
  // tests/data/signatures.catalog.test.ts.
  it('nessuna firma orfana, e al massimo una per mago', () => {
    for (const s of SIGNATURES) expect(WIZARDS.some(w => w.id === s.id), `orphan signature ${s.id}`).toBe(true)
    const ids = SIGNATURES.map(s => s.id)
    expect(new Set(ids).size, 'un mago non puo\' avere due firme').toBe(ids.length)
  })

  it('le firme di tier 1 portano 2 trigger; ogni firma ne ha almeno 1', () => {
    // Itera sulle FIRME, non sui maghi: la maggior parte dei maghi ora non ne ha nessuna.
    // I 3 maghi di tier 1 tengono tutti la loro firma, quindi la regola dei 2 trigger e'
    // ancora coperta davvero.
    for (const sig of SIGNATURES) {
      expect(sig.triggers.length, `${sig.id} trigger count`).toBeGreaterThanOrEqual(1)
      const tier = WIZARDS.find(w => w.id === sig.id)!.tier
      if (tier === 1) expect(sig.triggers.length, `${sig.id} is tier 1`).toBe(2)
    }
    const tier1WithSig = SIGNATURES.filter(s => WIZARDS.find(w => w.id === s.id)!.tier === 1)
    expect(tier1WithSig, 'tutti e 3 i tier 1 tengono la firma').toHaveLength(3)
  })

  it('a signature whose text says "avvelen…" applies veleno, not burn (theme↔mechanic match)', () => {
    const ctx: HookCtx = { turn: 1, actor: {} as never, target: {} as never, side: 'left', flags: [] }
    const mismatched: string[] = []
    for (const sig of SIGNATURES) {
      if (!/avvelen/i.test(sig.desc)) continue
      const statuses = sig.triggers.flatMap(t =>
        t.kind === 'reactive' ? t.effects(ctx).flatMap(e => (e.kind === 'applyStatus' && e.statusId ? [e.statusId] : [])) : [])
      // a "poisons" signature must apply veleno and must NOT apply burn as its DoT
      if (!statuses.includes('veleno')) mismatched.push(`${sig.id}: text says avvelena but applies [${statuses.join(',')}]`)
      if (statuses.includes('burn')) mismatched.push(`${sig.id}: text says avvelena but applies burn`)
    }
    expect(mismatched, mismatched.join('\n')).toEqual([])
  })

  it('every referenced statusId exists and no trigger throws', () => {
    // Stub a wounded actor vs a low-HP target so wounded/execute branches run.
    const mk = (id: string) => ({
      wizard: WIZARDS[0], stats: { hp: 100, atk: 20, def: 10, spd: 20 }, maxHp: 100,
      spell: { id, name: id, desc: '', type: 'Attacco', hitChance: 1 },
      side: 'left', hp: 5, cooldowns: {}, statusEffects: [], buffedStats: { hp: 100, atk: 20, def: 10, spd: 30 }, alive: true,
    }) as any
    const actor = mk('a'); const target = mk('b'); target.buffedStats.spd = 5
    const ctx: HookCtx = { turn: 1, actor, target, side: 'left', flags: [] }
    for (const sig of SIGNATURES) {
      for (const t of sig.triggers) {
        if (t.kind === 'modifier') {
          expect(() => t.apply(10, ctx), `${sig.id} modifier throws`).not.toThrow()
        } else {
          const effs = t.effects(ctx)
          for (const e of effs) {
            if (e.kind === 'applyStatus' && e.statusId) {
              expect(STATUS_BY_ID[e.statusId], `${sig.id} → unknown status ${e.statusId}`).toBeDefined()
            }
          }
        }
      }
    }
  })
})
