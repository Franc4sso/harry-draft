import { describe, it, expect } from 'vitest'
import type { BattleUnit, DraftedWizard, EffectSpec, Side } from '@/types'
import { SPELL_BY_ID } from '@/data/spells'
import { scaledSpell, spellMultiplier } from '@/game/engine/spellForge'
import { applyStatus, effectiveStats, tickStatuses } from '@/game/engine/status'

// Every spell must gain SOMETHING from an "Aumento Magia" upgrade. Before this suite,
// scaledSpell only scaled inline power/heal/effects.amount and spec damage/heal — so pure
// control (duration only), shields, statusId-referenced buffs/debuffs, veleno, ward count,
// and revive fraction all levelled up to ZERO benefit. These tests pin the fix.

const round2 = (n: number): number => Math.round(n * 100) / 100

/** The applyStatus spec for a given statusId within a scaled spell's spec[]. */
function statusSpec(spec: EffectSpec[] | undefined, statusId: string) {
  return (spec ?? []).find(
    (s): s is Extract<EffectSpec, { kind: 'applyStatus' }> =>
      s.kind === 'applyStatus' && s.statusId === statusId,
  )
}

describe('spellForge coverage — every spell benefits from leveling', () => {
  const L = 6
  const m = spellMultiplier(L) // 1.75 at level 6
  const STEP = 2               // duration/count breakpoint bonus at level 6

  it('shield magnitude scales (Aegis)', () => {
    const scaled = scaledSpell(SPELL_BY_ID['aegis']!, L)
    const shield = scaled.spec!.find(s => s.kind === 'shield')!
    expect(shield.kind === 'shield' && shield.amount).toBe(Math.round(60 * m))
  })

  it('Fianto Duri scales its shield AND flags its defUp buff for scaling', () => {
    const scaled = scaledSpell(SPELL_BY_ID['fianto']!, L)
    const shield = scaled.spec!.find(s => s.kind === 'shield')!
    expect(shield.kind === 'shield' && shield.amount).toBe(Math.round(40 * m))
    expect(statusSpec(scaled.spec, 'defUp')?.magMult).toBeCloseTo(m)
  })

  it('statusId self-buff spells flag their buff magnitude for scaling (Salvio → spdUp)', () => {
    const scaled = scaledSpell(SPELL_BY_ID['salvio']!, L)
    expect(statusSpec(scaled.spec, 'spdUp')?.magMult).toBeCloseTo(m)
  })

  it('serpensortia scales its direct damage AND flags its veleno for scaling', () => {
    const scaled = scaledSpell(SPELL_BY_ID['serpensortia']!, L)
    const dmg = scaled.spec!.find(s => s.kind === 'damage')!
    expect(dmg.kind === 'damage' && dmg.power).toBe(round2(0.45 * m))
    expect(statusSpec(scaled.spec, 'veleno')?.magMult).toBeCloseTo(m)
  })

  it('inline-control duration gets a breakpoint bonus (Imperio stun 2 → 4)', () => {
    const scaled = scaledSpell(SPELL_BY_ID['imperio']!, L)
    const stun = scaled.effects!.find(e => e.kind === 'stun')!
    expect(stun.duration).toBe(2 + STEP)
  })

  it('spec-control duration gets a breakpoint bonus (Silencio silence 2 → 4, Glacius freeze 1 → 3)', () => {
    const sil = scaledSpell(SPELL_BY_ID['silencio']!, L)
    expect(statusSpec(sil.spec, 'silence')?.duration).toBe(2 + STEP)
    const gla = scaledSpell(SPELL_BY_ID['glacius']!, L)
    expect(statusSpec(gla.spec, 'freeze')?.duration).toBe(1 + STEP)
  })

  it('Protego gains ward charges and a longer ward at breakpoints', () => {
    const scaled = scaledSpell(SPELL_BY_ID['protego']!, L)
    const ward = scaled.spec!.find(s => s.kind === 'protego')!
    expect(ward.kind === 'protego' && ward.count).toBe(1 + STEP)
  })

  it('Rennervate revives to a higher fraction (0.20 → 0.35 at Lv6)', () => {
    const scaled = scaledSpell(SPELL_BY_ID['rennervate']!, L)
    expect(scaled.revive).toBe(round2(0.2 * m)) // 0.35
  })

  it('level 1 is a strict no-op (byte-identical base) for every category', () => {
    for (const id of ['aegis', 'salvio', 'imperio', 'silencio', 'protego', 'rennervate', 'serpensortia']) {
      expect(scaledSpell(SPELL_BY_ID[id]!, 1)).toBe(SPELL_BY_ID[id]!)
    }
  })
})

// ---- engine integration: the scaled spec must actually change combat ----

function unit(side: Side, id: string, over: Partial<BattleUnit> = {}): BattleUnit {
  const stats = { hp: 1000, atk: 80, def: 30, spd: 40 }
  const dw: DraftedWizard = {
    wizard: { id, name: id, house: 'Grifondoro', role: 'Attaccante', tier: 3,
      gender: 'm' as const, ranges: { hp: [1000, 1000], atk: [80, 80], def: [30, 30], spd: [40, 40] }, spellPool: ['base_attack'] },
    stats, maxHp: 1000, spell: SPELL_BY_ID['base_attack']!,
  } as never
  return { ...dw, side, hp: 1000, cooldowns: {}, statusEffects: [], buffedStats: stats, alive: true, ...over }
}

describe('spellForge coverage — engine honors the scaled magnitude', () => {
  it('applyStatus magMult scales a buff\'s real stat contribution (spdUp 20 → 35)', () => {
    const u = unit('left', 'p1')
    applyStatus(u, 'spdUp', { magMult: 1.75 })
    // base spd 40 + round(20 * 1.75) = 40 + 35 = 75
    expect(effectiveStats(u).spd).toBe(75)
  })

  it('applyStatus magMult scales veleno tick damage (4 → 7 per stack)', () => {
    const u = unit('right', 'e1')
    applyStatus(u, 'veleno', { magMult: 1.75 })
    const before = u.hp
    tickStatuses(1, u)
    // tick = round(4 * 1.75)=7 flat + 1 stack * 0.005 * 1000 maxHp = 5 → 12
    expect(before - u.hp).toBe(7 + 5)
  })

  it('unscaled applyStatus (no magMult) is unchanged (spdUp still 20)', () => {
    const u = unit('left', 'p1')
    applyStatus(u, 'spdUp')
    expect(effectiveStats(u).spd).toBe(60) // 40 + 20
  })
})
