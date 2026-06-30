import { describe, it, expect } from 'vitest'
import { generateArea } from '@/game/engine/map'
import { createRng } from '@/game/engine/rng'
import { detectSynergies } from '@/game/engine/synergy'
import { mapRngChannel } from '@/game/engine/map'

const areaRng = (seed: string, area: number) => createRng(seed).fork(mapRngChannel).fork(area)
const bias = { teamSize: 2, teamMax: 5 }

describe('generateArea pre-generation', () => {
  it('attaches battle + preview to every combat node', () => {
    const nodes = generateArea(areaRng('seed', 0), 'seed', 0, bias)
    const combat = nodes.filter(n => n.type === 'battle' || n.type === 'elite' || n.type === 'boss')
    expect(combat.length).toBeGreaterThan(0)
    for (const n of combat) {
      expect(n.battle).toBeDefined()
      expect(n.battle!.enemyTeam.length).toBeGreaterThan(0)
      expect(n.preview).toBeDefined()
    }
  })

  it('preview.synergyIds matches detectSynergies(enemyTeam) for non-boss nodes', () => {
    const nodes = generateArea(areaRng('seed', 1), 'seed', 1, bias)
    for (const n of nodes.filter(n => n.type === 'battle' || n.type === 'elite')) {
      const detected = detectSynergies(n.battle!.enemyTeam).map(s => s.synergy.id).sort()
      expect([...n.preview!.synergyIds].sort()).toEqual(detected)
    }
  })

  it('is deterministic: same seed → identical packages', () => {
    const a = generateArea(areaRng('seed', 0), 'seed', 0, bias)
    const b = generateArea(areaRng('seed', 0), 'seed', 0, bias)
    const ids = (ns: typeof a) => ns.filter(n => n.battle)
      .map(n => `${n.id}:${n.battle!.enemyTeam.map(d => d.wizard.id).join('+')}`)
    expect(ids(a)).toEqual(ids(b))
  })
})
