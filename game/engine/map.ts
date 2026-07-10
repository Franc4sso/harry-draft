import type { RunNode } from '@/types'
import type { Rng } from './rng'
import { BALANCE } from '@/data/constants'
import { assignAreaCategories, type AreaBias } from './nodeGen'
import { buildBattlePackage } from './combat/battlePackage'

export const mapRngChannel = 4

/** Parse the floor index from a node id of the form `f{floor}n{index}`. */
export function nodeDepth(id: string): number {
  const m = /^f(\d+)n\d+$/.exec(id)
  if (!m) throw new Error(`bad node id: ${id}`)
  return Number(m[1])
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
 * coverage (no orphans, no dead ends before the boss).
 *
 * RNG: `area` is NOT folded into the random stream — it only tags node ids. The
 * CALLER owns per-area isolation: pass a per-area-forked rng (e.g.
 * `mapRng.fork(area)`) so two areas with equal widths don't generate identical
 * categories/layouts. (Spec §6.4: fork per (seed, mapChannel, area).)
 */
export function generateArea(rng: Rng, seed: string, area: number, bias: AreaBias, endless = false): RunNode[] {
  const { floorsPerArea } = BALANCE.map
  const last = floorsPerArea - 1

  // 1. Floor widths.
  const widths: number[] = []
  for (let f = 0; f < floorsPerArea; f++) {
    // Floor 0 = entry battle, last = boss → both width 1 (single entrance / single boss).
    // Every other floor, INCLUDING the pre-boss floor (last-1), is always 3 wide (design:
    // every non-entry/non-boss step always offers 3 nodes). The pre-boss floor guarantees
    // exactly one Infermeria among its 3 nodes (see assignAreaCategories); the other 2 slots
    // are ordinary battle/recruit/relic fillers, same dedup rules as any other middle floor.
    const forcedOne = f === 0 || f === last
    widths.push(forcedOne ? 1 : 3)
  }

  // 2. Categories (hard guarantees live in nodeGen).
  const cats = assignAreaCategories(rng.fork(777), widths, bias, endless)

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

  // Pre-generate each combat node's full battle package (single source of truth);
  // walk in id order so anti-repetition (excludeThemes) is deterministic.
  const flat = floorNodes.flat().sort((a, b) => a.id.localeCompare(b.id))
  const usedThemes: string[] = []
  for (const node of flat) {
    if (node.type !== 'battle' && node.type !== 'elite' && node.type !== 'boss') continue
    const { floor } = parseAreaNodeId(node.id)
    // Exclude the last-2 themes used in this area (recent-neighbor anti-repetition).
    const { battle, preview, themeId } = buildBattlePackage(
      seed, area, floor, node.type, usedThemes.slice(-2), endless,
    )
    node.battle = battle
    node.preview = preview
    if (themeId) usedThemes.push(themeId)
  }
  return flat
}
