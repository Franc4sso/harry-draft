import { describe, it, expect } from 'vitest'
import { resolveAction } from '@/game/engine/combat/resolve'
import { selectSpell } from '@/game/engine/combat/selectSpell'
import { canCastSpell } from '@/game/engine/status'
import { createRng } from '@/game/engine/rng'
import type { BattleUnit, DraftedWizard } from '@/types'
import { SPELL_BY_ID } from '@/data/spells'

// Harness copied from tests/engine/combat/statusIntegration.test.ts.
function unit(id: string, spellId: string, over: Partial<BattleUnit> = {}): BattleUnit {
  const stats = { hp: 120, atk: 80, def: 30, spd: 40 }
  const dw: DraftedWizard = {
    wizard: { id, name: id, house: 'Grifondoro', role: 'Attaccante', tier: 3,
      gender: 'm' as const, ranges: { hp: [120,120], atk: [80,80], def: [30,30], spd: [40,40] }, spellPool: [spellId] },
    stats, maxHp: 120, spell: SPELL_BY_ID[spellId]!,
  }
  return { ...dw, side: 'left', hp: 120, cooldowns: {}, statusEffects: [], buffedStats: stats, alive: true, ...over }
}

describe('silence gates spellcasting in the sim turn loop', () => {
  it('a silenced unit does not emit a spell-cast log entry across the silence duration', () => {
    const caster = unit('caster', 'silencio')
    // sectumsempra is the target's own spell — it should never appear in the target's
    // action log while silenced; only base_attack ('Colpo Base') may appear.
    const target = unit('target', 'sectumsempra', { side: 'right' })

    // Land silence on the target (duration 2, per data/spells.ts silencio).
    resolveAction(createRng(1), 1, caster, target, SPELL_BY_ID['silencio']!)
    expect(target.statusEffects.some(e => e.statusId === 'silence')).toBe(true)
    expect(canCastSpell(target)).toBe(false)

    // Simulate the target's turns while silenced: selectSpell must never resolve to the
    // target's own spell, and any resolved action must not be the target's spell name.
    const actionsWhileSilenced: string[] = []
    for (let turn = 2; turn <= 3; turn++) {
      const spell = selectSpell(target)
      expect(spell).not.toBeNull()
      expect(spell!.id).not.toBe('sectumsempra')
      const entry = resolveAction(createRng(turn), turn, target, caster, spell!)
      actionsWhileSilenced.push(entry.action)
      // tick down the silence status like the real end-of-turn loop would
      for (const e of target.statusEffects) e.remaining -= 1
      target.statusEffects = target.statusEffects.filter(e => e.remaining > 0)
    }

    expect(actionsWhileSilenced).not.toContain('Sectumsempra')
    expect(actionsWhileSilenced.every(a => a === 'Colpo Base')).toBe(true)
  })
})
