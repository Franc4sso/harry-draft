import type { RunNode, RunNodeType } from '@/types'
import type { Rng } from './rng'
import { BALANCE } from '@/data/constants'
import { assignAreaCategories, type AreaBias } from './nodeGen'

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
    if (f === 0 || f === last || (last - 1 >= 1 && f === last - 1)) widths.push(1)
    else widths.push(rng.int(minWidth, maxWidth))
  }
  const typeForFloor = (f: number): RunNodeType =>
    f === last
      ? 'boss'
      : last - 1 >= 1 && f === last - 1
        ? 'infirmary'
        : eliteFloors.includes(f)
          ? 'elite'
          : 'battle'

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

const areaNodeId = (area: number, floor: number, index: number) => `a${area}f${floor}n${index}`

/** Parse an area-aware node id of the form `a{area}f{floor}n{idx}`. */
export function parseAreaNodeId(id: string): { area: number; floor: number; idx: number } {
  const m = /^a(\d+)f(\d+)n(\d+)$/.exec(id)
  if (!m) throw new Error(`bad area node id: ${id}`)
  return { area: Number(m[1]), floor: Number(m[2]), idx: Number(m[3]) }
}

/**
 * Build one area's branching atlas. Floor 0 is a single entry battle; the last
 * floor is a single boss; middle floors have rng-width nodes. Categories come
 * from `assignAreaCategories`. Edges connect only adjacent floors with full
 * coverage (no orphans, no dead ends before the boss) — same wiring as
 * `generateMap`, but area-tagged.
 *
 * RNG: `area` is NOT folded into the random stream — it only tags node ids. The
 * CALLER owns per-area isolation: pass a per-area-forked rng (e.g.
 * `mapRng.fork(area)`) so two areas with equal widths don't generate identical
 * categories/layouts. (Spec §6.4: fork per (seed, mapChannel, area).)
 */
export function generateArea(rng: Rng, area: number, bias: AreaBias): RunNode[] {
  const { floorsPerArea, minWidth, maxWidth } = BALANCE.map
  const last = floorsPerArea - 1

  // 1. Floor widths.
  const widths: number[] = []
  for (let f = 0; f < floorsPerArea; f++) {
    widths.push(f === 0 || f === last ? 1 : rng.int(minWidth, maxWidth))
  }

  // 2. Categories (hard guarantees live in nodeGen).
  const cats = assignAreaCategories(rng.fork(777), widths, bias)

  // 3. Nodes.
  const floorNodes: RunNode[][] = widths.map((w, f) =>
    Array.from({ length: w }, (_, i) => ({ id: areaNodeId(area, f, i), type: cats[f]![i]!, next: [] as string[] })),
  )

  // 4. Edges f -> f+1: each node links to the (up to) TWO nearest next-floor nodes
  //    by proportional column position, then guarantee no orphan (every next node
  //    has an incoming edge). Boss/entry convergence (width 1) yields a single edge.
  for (let f = 0; f < last; f++) {
    const cur = floorNodes[f]!
    const nxt = floorNodes[f + 1]!
    const want = Math.min(2, nxt.length)
    cur.forEach((node, i) => {
      const pos = cur.length > 1 ? (i / (cur.length - 1)) * (nxt.length - 1) : (nxt.length - 1) / 2
      const nearest = [...nxt.keys()]
        .sort((a, b) => Math.abs(a - pos) - Math.abs(b - pos) || a - b)
        .slice(0, want)
      for (const j of nearest) if (!node.next.includes(nxt[j]!.id)) node.next.push(nxt[j]!.id)
    })
    const covered = new Set(cur.flatMap(n => n.next))
    nxt.forEach((target, j) => {
      if (covered.has(target.id)) return
      const pos = nxt.length > 1 ? (j / (nxt.length - 1)) * (cur.length - 1) : (cur.length - 1) / 2
      const src = cur.reduce((best, n, i) =>
        Math.abs(i - pos) < Math.abs(cur.indexOf(best) - pos) ? n : best, cur[0]!)
      if (!src.next.includes(target.id)) src.next.push(target.id)
    })
    cur.forEach(node => node.next.sort())
  }

  return floorNodes.flat()
}
