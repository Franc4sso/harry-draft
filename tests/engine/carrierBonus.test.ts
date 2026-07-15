import { describe, it, expect } from 'vitest'
import { applyRelicBonuses } from '@/game/engine/relics'
import { toBattleUnits } from '@/game/engine/combat/simulate'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARD_BY_ID, WIZARDS } from '@/data/wizards'
import { SPELL_BY_ID } from '@/data/spells'
import { RELIC_BY_ID } from '@/data/relics'
import type { ActiveRelic, DraftedWizard, Stats } from '@/types'

function team(ids: string[]) {
  const r = createRng(1)
  return ids.map(id => draftWizard(r, WIZARD_BY_ID[id]!))
}

const carrier = (assignedTo?: string): ActiveRelic => ({
  relic: { id: 'test-carrier', name: 'Test Carrier', desc: '', rarity: 'epica', assignable: true, carrierBonus: { atk: 60, spd: 30 } },
  stageObtained: 0,
  ...(assignedTo ? { assignedTo } : {}),
})

describe('applyRelicBonuses — carrierBonus', () => {
  const base = { hp: 100, atk: 100, def: 100, spd: 100 }

  it('applies carrierBonus only to the assigned wizardId', () => {
    const t = team(['harry', 'ron'])
    const [a, b] = t as [DraftedWizard, DraftedWizard]
    const relics = [carrier(a.wizard.id)]
    const outA = applyRelicBonuses(base, t, relics, a.wizard.id)
    const outB = applyRelicBonuses(base, t, relics, b.wizard.id)
    expect(outA.atk).toBe(100 + 60)
    expect(outA.spd).toBe(100 + 30)
    expect(outB).toEqual(base)
  })

  it('is inert for everyone when unassigned', () => {
    const t = team(['harry', 'ron'])
    const [a, b] = t as [DraftedWizard, DraftedWizard]
    const relics = [carrier(undefined)]
    expect(applyRelicBonuses(base, t, relics, a.wizard.id)).toEqual(base)
    expect(applyRelicBonuses(base, t, relics, b.wizard.id)).toEqual(base)
  })

  it('is inert when wizardId is omitted (retro-compat, 4th param not passed)', () => {
    const t = team(['harry', 'ron'])
    const [a] = t as [DraftedWizard, DraftedWizard]
    const relics = [carrier(a.wizard.id)]
    expect(applyRelicBonuses(base, t, relics)).toEqual(base)
  })
})

describe('toBattleUnits — carrierBonus', () => {
  const mk = (id: string, stats: Stats): DraftedWizard => ({
    wizard: WIZARDS.find(w => w.id === id)!, stats, maxHp: stats.hp, spell: SPELL_BY_ID['base_attack']!,
  })
  const S: Stats = { hp: 200, atk: 20, def: 20, spd: 20 }

  it('buffs only the carrier unit, others unchanged', () => {
    const t = [mk('voldemort', S), mk('snape', S)]
    const relics = [carrier('voldemort')]
    const units = toBattleUnits(t, 'left', [], relics)
    const vold = units.find(u => u.wizard.id === 'voldemort')!
    const snape = units.find(u => u.wizard.id === 'snape')!
    expect(vold.buffedStats.atk).toBe(S.atk + 60)
    expect(vold.buffedStats.spd).toBe(S.spd + 30)
    expect(snape.buffedStats.atk).toBe(S.atk)
    expect(snape.buffedStats.spd).toBe(S.spd)
  })
})

describe('mano-della-gloria data', () => {
  it('is assignable, carries carrierBonus, and has NO team-wide bonus', () => {
    const r = RELIC_BY_ID['mano-della-gloria']!
    expect(r.assignable).toBe(true)
    expect(r.carrierBonus).toEqual({ atk: 60, spd: 30 })
    expect(r.bonus).toBeUndefined()
  })
})
