import { describe, it, expect } from 'vitest'
import { startRunB, chooseStarters, setWizardSpell } from '@/game/engine/runEngine'
import { createRng } from '@/game/engine/rng'

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
