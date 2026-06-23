import type { RunNode, RunNodeType } from '@/types'
import type { Rng } from './rng'
import { BALANCE } from '@/data/constants'

export const mapRngChannel = 4

/** Parse the floor index from a node id of the form `f{floor}n{index}`. */
export function nodeDepth(id: string): number {
  const m = /^f(\d+)n\d+$/.exec(id)
  if (!m) throw new Error(`bad node id: ${id}`)
  return Number(m[1])
}

const nodeId = (floor: number, index: number) => `f${floor}n${index}`

/**
 * Build a floor-by-floor branching graph. Floor 0 is a single battle start;
 * the last floor is a single boss; middle floors have rng-width nodes. Edges
 * connect only adjacent floors and guarantee full reachability with no orphan
 * nodes and no dead ends before the boss.
 */
export function generateMap(rng: Rng): RunNode[] {
  const { floors, minWidth, maxWidth, eliteFloors } = BALANCE.map
  const last = floors - 1

  // 1. Decide each floor's nodes (ids + types).
  const widths: number[] = []
  for (let f = 0; f < floors; f++) {
    if (f === 0 || f === last) widths.push(1)
    else widths.push(rng.int(minWidth, maxWidth))
  }
  const typeForFloor = (f: number): RunNodeType =>
    f === last ? 'boss' : eliteFloors.includes(f) ? 'elite' : 'battle'

  const floorNodes: RunNode[][] = widths.map((w, f) =>
    Array.from({ length: w }, (_, i) => ({ id: nodeId(f, i), type: typeForFloor(f), next: [] as string[] })),
  )

  // 2. Wire edges floor f -> f+1 with full coverage both directions.
  for (let f = 0; f < last; f++) {
    const cur = floorNodes[f]!
    const nxt = floorNodes[f + 1]!
    // (a) every current node connects to at least one next node (round-robin start)
    cur.forEach((node, i) => {
      node.next.push(nxt[i % nxt.length]!.id)
    })
    // (b) every next node must be covered by at least one incoming edge
    const covered = new Set(cur.flatMap(n => n.next))
    nxt.forEach((target, j) => {
      if (covered.has(target.id)) return
      // attach to a deterministic current node (j-th, wrapped)
      const src = cur[j % cur.length]!
      if (!src.next.includes(target.id)) src.next.push(target.id)
    })
    // (c) deterministic extra edge for branching where width allows
    if (nxt.length > 1) {
      cur.forEach((node, i) => {
        const extra = nxt[(i + 1) % nxt.length]!.id
        if (!node.next.includes(extra) && rng.chance(0.5)) node.next.push(extra)
      })
    }
    // sort each node's next by id for determinism/readability
    cur.forEach(node => node.next.sort())
  }

  return floorNodes.flat()
}
