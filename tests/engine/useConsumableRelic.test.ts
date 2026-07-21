import { describe, it, expect } from 'vitest'
import { useConsumableRelic } from '@/game/engine/runEngine'
import { detectSynergies } from '@/game/engine/synergy'
import { livingOf } from '@/game/engine/roster'
import { WIZARDS } from '@/data/wizards'
import { SPELL_BY_ID } from '@/data/spells'
import type { ActiveRelic, DraftedWizard, RunState } from '@/types'

// ── fixtures ────────────────────────────────────────────────────────────────

const mk = (id: string, currentHp?: number): DraftedWizard => ({
  wizard: WIZARDS.find(w => w.id === id)!,
  stats: { hp: 100, atk: 10, def: 10, spd: 10 },
  maxHp: 100,
  spell: SPELL_BY_ID['base_attack']!,
  ...(currentHp !== undefined ? { currentHp } : {}),
})

/** A proper Lacrime di Fenice ActiveRelic fixture (data not yet imported — defined inline). */
const lacrimeFenice: ActiveRelic = {
  relic: { id: 'lacrime-fenice', name: 'Lacrime di Fenice', desc: 'Una sola volta.', rarity: 'epica', active: 'revive' },
  stageObtained: 0,
}

/** A passive relic (no active field) used for the guard test. */
const passiveRelic: ActiveRelic = {
  relic: { id: 'giratempo', name: 'Giratempo', desc: '+12 Velocità.', rarity: 'comune', bonus: { spd: 12 } },
  stageObtained: 0,
}

function mkState(team: DraftedWizard[], relics: ActiveRelic[]): RunState {
  return {
    seed: 'test',
    phase: 'map',
    stage: 0,
    team,
    relics,
    activeSynergies: detectSynergies(livingOf(team)),
    log: [],
    pendingLevelUps: [],
  } as unknown as RunState
}

// ── tests ────────────────────────────────────────────────────────────────────

describe('useConsumableRelic — revive', () => {
  it('revives a dead wizard to full HP and consumes the relic', () => {
    const state = mkState([mk('harry', 0), mk('ron')], [lacrimeFenice])
    const out = useConsumableRelic(state, 'lacrime-fenice')
    expect(out.team.find(d => d.wizard.id === 'harry')!.currentHp).toBe(100)
    expect(out.relics.find(a => a.relic.id === 'lacrime-fenice')).toBeUndefined()
  })

  it('does NOT top up living wounded wizards — only dead wizards are revived', () => {
    const state = mkState([mk('harry', 0), mk('ron', 50)], [lacrimeFenice])
    const out = useConsumableRelic(state, 'lacrime-fenice')
    // harry was dead → full HP
    expect(out.team.find(d => d.wizard.id === 'harry')!.currentHp).toBe(100)
    // ron was wounded but alive → unchanged
    expect(out.team.find(d => d.wizard.id === 'ron')!.currentHp).toBe(50)
  })

  it('recomputes activeSynergies after reviving a wizard that re-activates a synergy', () => {
    // goldenTrio (harry+ron+hermione, id-list synergy) was removed along with the other 8 team
    // synergies (2026-07-21) — Tossicità (tag:veleno, requires 3) is the only synergy left, so
    // this fixture switches to 3 veleno-tagged wizards to keep exercising the same real
    // behavior: activeSynergies must be recomputed from the LIVING team after a revive.
    // bellatrix/pansy/blaise are veleno-tagged (same trio used elsewhere, e.g.
    // tests/engine/synergyRemoval.test.ts).
    const state = mkState([mk('bellatrix', 0), mk('pansy'), mk('blaise')], [lacrimeFenice])
    expect(state.activeSynergies.find(s => s.synergy.id === 'tossicita')).toBeUndefined()

    const out = useConsumableRelic(state, 'lacrime-fenice')
    // activeSynergies must equal detectSynergies(livingOf(newTeam))
    const expected = detectSynergies(livingOf(out.team))
    expect(out.activeSynergies).toEqual(expected)
    // tossicita now active because bellatrix is back
    expect(out.activeSynergies.find(s => s.synergy.id === 'tossicita')).toBeTruthy()
  })
})

describe('useConsumableRelic — no-op guards (same state reference, relic NOT consumed)', () => {
  it('returns the same state when relicId is not owned', () => {
    const state = mkState([mk('harry', 0)], [lacrimeFenice])
    const out = useConsumableRelic(state, 'non-existent-relic')
    expect(out).toBe(state)
    expect(out.relics).toHaveLength(1)
  })

  it('returns the same state when the owned relic has no active:revive', () => {
    const state = mkState([mk('harry', 0)], [passiveRelic])
    const out = useConsumableRelic(state, 'giratempo')
    expect(out).toBe(state)
    expect(out.relics).toHaveLength(1)
  })

  it('returns the same state when no wizard is dead (nothing to revive)', () => {
    const state = mkState([mk('harry'), mk('ron', 80)], [lacrimeFenice])
    const out = useConsumableRelic(state, 'lacrime-fenice')
    expect(out).toBe(state)
    expect(out.relics).toHaveLength(1)
  })
})
