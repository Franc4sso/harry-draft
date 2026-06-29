import { describe, it, expect } from 'vitest'
import { infirmaryResolver } from '@/game/engine/resolvers/infirmary'
import { WIZARDS } from '@/data/wizards'
import { SPELL_BY_ID } from '@/data/spells'
import { createRng } from '@/game/engine/rng'
import type { DraftedWizard, RunNode, RunState } from '@/types'

const mk = (id: string, currentHp?: number): DraftedWizard => ({
  wizard: WIZARDS.find(w => w.id === id)!, stats: { hp: 100, atk: 10, def: 10, spd: 10 },
  maxHp: 100, spell: SPELL_BY_ID['base_attack']!, ...(currentHp !== undefined ? { currentHp } : {}),
})

describe('infirmaryResolver', () => {
  it('heals the wounded and revives the dead to full HP', () => {
    const state = { team: [mk('harry', 30), mk('voldemort', 0), mk('snape')], relics: [], log: [] } as unknown as RunState
    const node = { id: 'inf-0', type: 'infirmary', next: [] } as RunNode
    const out = infirmaryResolver.resolve(state, node, { kind: 'combat-ack' }, createRng('x'))
    expect(out.team.every(d => d.currentHp === d.maxHp)).toBe(true)   // all full
    expect(out.team.find(d => d.wizard.id === 'voldemort')!.currentHp).toBe(100)  // revived
  })
})
