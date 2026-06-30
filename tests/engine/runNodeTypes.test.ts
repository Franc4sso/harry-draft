import { describe, it, expect } from 'vitest'
import type { RunNode, NodeBattle, NodePreview } from '@/types'

describe('RunNode themed-battle fields', () => {
  it('accepts an optional battle package and preview', () => {
    const battle: NodeBattle = { enemyTeam: [], enemyRelics: [], enemyLevel: 3 }
    const preview: NodePreview = { synergyIds: ['gryffindor3'] }
    const node: RunNode = { id: 'a0f0n0', type: 'battle', next: [], battle, preview }
    expect(node.battle?.enemyLevel).toBe(3)
    expect(node.preview?.synergyIds).toEqual(['gryffindor3'])
    // legacy node (no battle/preview) still valid
    const legacy: RunNode = { id: 'a0f1n0', type: 'battle', next: [] }
    expect(legacy.battle).toBeUndefined()
  })
})
