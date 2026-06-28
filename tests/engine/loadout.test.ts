import { describe, it, expect } from 'vitest'
import { startRunB, chooseStarters, setWizardSpell } from '@/game/engine/runEngine'
import { createRng } from '@/game/engine/rng'
import { simulateBattle } from '@/game/engine/combat/simulate'
import { SPELL_BY_ID } from '@/data/spells'
import { WIZARDS } from '@/data/wizards'
import type { DraftedWizard } from '@/types'

function caster(id: string, spellId: string): DraftedWizard {
  const wizard = WIZARDS.find(w => w.id === id)!
  return { wizard, stats: { hp: 300, atk: 40, def: 15, spd: 40 }, maxHp: 300, spell: SPELL_BY_ID[spellId]! }
}

function startedRun() {
  let s = startRunB('loadout-1')
  const ids = ['dolohov', 'bellatrix']
  s = chooseStarters(s, 'Serpeverde', ids, createRng('loadout-1'))
  return s
}

describe('setWizardSpell', () => {
  it('sets a team member spell to another spell from its pool', () => {
    const s = startedRun()
    const dolohov = s.team.find(d => d.wizard.id === 'dolohov')!
    const target = dolohov.wizard.spellPool.find(id => id !== dolohov.spell.id)!
    const next = setWizardSpell(s, 'dolohov', target)
    expect(next.team.find(d => d.wizard.id === 'dolohov')!.spell.id).toBe(target)
    expect(s.team.find(d => d.wizard.id === 'dolohov')!.spell.id).not.toBe(target)
  })
  it('is a no-op for a spell not in the wizard pool', () => {
    const s = startedRun()
    const next = setWizardSpell(s, 'dolohov', 'avada')
    expect(next).toBe(s)
  })
  it('is a no-op for an unknown wizard', () => {
    const s = startedRun()
    expect(setWizardSpell(s, 'nobody', 'crucio')).toBe(s)
  })
})

describe('serpensortia applies veleno', () => {
  it('a serpensortia caster poisons the enemy (dot flag appears against right)', () => {
    const left = [caster('dolohov', 'serpensortia')]
    const right = [{ ...caster('greyback', 'serpensortia'), stats: { hp: 800, atk: 1, def: 10, spd: 1 }, maxHp: 800 }]
    const r = simulateBattle(left, right, createRng('serp-1'))
    // Weak assertion: at least one 'dot' flag lands on right side
    const poisoned = r.log.some(e => e.targetSide === 'right' && e.flags.includes('dot'))
    expect(poisoned).toBe(true)
    // Stronger: greyback actually carries a veleno status entry in some snapshot
    const hasVeleno = r.snapshots.some(snap =>
      Object.entries(snap).some(([key, unit]) =>
        key.startsWith('right:') && unit.statusEffects.some(e => e.statusId === 'veleno')
      )
    )
    expect(hasVeleno).toBe(true)
  })
})
