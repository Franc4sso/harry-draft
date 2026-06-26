import type { RunNodeType } from '@/types'
import type { Rng } from './rng'
import { BALANCE } from '@/data/constants'

export interface AreaBias {
  teamSize: number
  teamMax: number
}

type Filler = 'battle' | 'recruit' | 'relic'

/** Flat list of (floor, idx) coordinates for the middle floors only. */
interface Slot { floor: number; idx: number }

/**
 * Assign a category to every node of an area.
 * Hard guarantees: floor 0 = battle; last floor = boss; exactly one elite in a
 * mid floor within [eliteMinFloor, len-2]; at least one recruit and one relic
 * among the middle nodes. Remaining middle nodes are weighted fillers, with a
 * recruit bias when the team is incomplete.
 */
export function assignAreaCategories(rng: Rng, widths: number[], bias: AreaBias): RunNodeType[][] {
  const last = widths.length - 1
  const cats: RunNodeType[][] = widths.map(w => new Array<RunNodeType>(w).fill('battle'))

  cats[0] = ['battle']
  cats[last] = ['boss']

  // Collect middle slots.
  const slots: Slot[] = []
  for (let f = 1; f < last; f++) {
    for (let i = 0; i < widths[f]!; i++) slots.push({ floor: f, idx: i })
  }

  // 1. Place the single elite within the allowed floor band.
  const eliteFloors: number[] = []
  for (let f = BALANCE.map.eliteMinFloor; f <= last - 1; f++) {
    if (widths[f]! > 0) eliteFloors.push(f)
  }
  const eliteFloor = rng.pick(eliteFloors)
  const eliteIdx = rng.int(0, widths[eliteFloor]! - 1)
  setCat(cats, eliteFloor, eliteIdx, 'elite')
  const used = new Set<string>([key(eliteFloor, eliteIdx)])

  // 2. Guarantee >=1 recruit and >=1 relic among the remaining middle slots.
  const free = () => slots.filter(s => !used.has(key(s.floor, s.idx)))
  for (const must of ['recruit', 'relic'] as Filler[]) {
    const pool = free()
    if (pool.length === 0) break
    const s = rng.pick(pool)
    setCat(cats, s.floor, s.idx, must)
    used.add(key(s.floor, s.idx))
  }

  // 3. Fill the rest with weighted fillers (recruit-biased when team incomplete).
  for (const s of free()) {
    setCat(cats, s.floor, s.idx, pickFiller(rng, bias))
    used.add(key(s.floor, s.idx))
  }

  return cats
}

function pickFiller(rng: Rng, bias: AreaBias): Filler {
  const cw = BALANCE.map.categoryWeights
  const recruitW = cw.recruit + (bias.teamSize < bias.teamMax ? BALANCE.map.recruitBiasBoost : 0)
  const entries: [Filler, number][] = [['battle', cw.battle], ['recruit', recruitW], ['relic', cw.relic]]
  const total = entries.reduce((a, [, v]) => a + v, 0)
  let roll = rng.next() * total
  for (const [cat, v] of entries) {
    roll -= v
    if (roll <= 0) return cat
  }
  return 'battle'
}

const key = (f: number, i: number) => `${f}:${i}`
function setCat(cats: RunNodeType[][], floor: number, idx: number, cat: RunNodeType): void {
  cats[floor]![idx] = cat
}
