import { describe, it, expect } from 'vitest'
import { NODE_CATALOG, nodeKind, phase1Types } from '@/game/engine/nodeCatalog'

describe('node catalog', () => {
  it('has an entry for every Fase-1 type with coherent flags', () => {
    for (const t of ['battle', 'elite', 'boss', 'recruit', 'relic', 'infirmary'] as const) {
      const k = nodeKind(t)
      expect(k.type).toBe(t)
      expect(k.label.length).toBeGreaterThan(0)
      expect(k.resolverId.length).toBeGreaterThan(0)
    }
  })
  it('marks combat nodes correctly', () => {
    expect(nodeKind('battle').isCombat).toBe(true)
    expect(nodeKind('elite').isCombat).toBe(true)
    expect(nodeKind('boss').isCombat).toBe(true)
    expect(nodeKind('recruit').isCombat).toBe(false)
    expect(nodeKind('relic').isCombat).toBe(false)
    expect(nodeKind('infirmary').isCombat).toBe(false)
  })
  it('phase1Types returns exactly the generated Fase-1 categories', () => {
    expect(new Set(phase1Types())).toEqual(new Set(['battle', 'elite', 'boss', 'recruit', 'relic', 'infirmary', 'spellForge', 'spellSwap']))
  })
  it('every catalog entry is self-consistent (key matches type)', () => {
    for (const [key, kind] of Object.entries(NODE_CATALOG)) {
      expect(kind.type).toBe(key)
    }
  })
})
