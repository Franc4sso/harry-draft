import type { RunNodeType } from '@/types'
import { nodeKind } from '../nodeCatalog'
import type { NodeResolver } from './types'

const REGISTRY = new Map<string, NodeResolver>()

export function registerResolver(r: NodeResolver): void {
  REGISTRY.set(r.id, r)
}

export function resolverFor(type: RunNodeType): NodeResolver {
  const id = nodeKind(type).resolverId
  const r = REGISTRY.get(id)
  if (!r) throw new Error(`no resolver registered for node type '${type}' (resolverId '${id}')`)
  return r
}

export function resolverIds(): string[] {
  return [...REGISTRY.keys()]
}
