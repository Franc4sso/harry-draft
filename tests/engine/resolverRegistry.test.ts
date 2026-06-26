import { describe, it, expect } from 'vitest'
import { registerResolver, resolverFor, resolverIds } from '@/game/engine/resolvers'
import type { NodeResolver } from '@/game/engine/resolvers/types'
import { nodeKind } from '@/game/engine/nodeCatalog'

const stub: NodeResolver = {
  id: 'battle',
  enter: () => ({ offers: {}, isCombat: true }),
  resolve: (s) => s,
}

describe('resolver registry', () => {
  it('registers and looks up a resolver by node type via the catalog resolverId', () => {
    registerResolver(stub)
    expect(resolverFor('battle').id).toBe(nodeKind('battle').resolverId)
  })
  it('throws for an unregistered node type', () => {
    expect(() => resolverFor('library')).toThrow(/no resolver/i)
  })
  it('lists registered ids', () => {
    expect(resolverIds()).toContain('battle')
  })
})
