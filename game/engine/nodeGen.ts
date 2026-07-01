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
 * Hard guarantees: floor 0 = battle; last floor = boss; floor last-1 = infirmary
 * (pre-boss heal funnel, width 1); exactly one elite in a mid floor within
 * [eliteMinFloor, last-2]; at least one recruit and one relic among the remaining
 * middle nodes. Remaining middle nodes are weighted fillers, with a recruit bias
 * when the team is incomplete.
 */
export function assignAreaCategories(rng: Rng, widths: number[], bias: AreaBias): RunNodeType[][] {
  if (widths.length < 3) throw new Error(`area needs >=3 floors, got ${widths.length}`)
  if (widths[0] !== 1 || widths[widths.length - 1] !== 1) {
    throw new Error(`entry and boss floors must have width 1, got widths[0]=${widths[0]}, widths[last]=${widths[widths.length - 1]}`)
  }

  const last = widths.length - 1
  const cats: RunNodeType[][] = widths.map(w => new Array<RunNodeType>(w).fill('battle'))

  cats[0] = ['battle']
  cats[last] = ['boss']
  // Pre-boss floor: guaranteed single Infermeria node (heals the team before every boss).
  if (last - 1 >= 1) cats[last - 1] = ['infirmary']

  // Collect middle slots — EXCLUDING floor last-1 (infirmary, already assigned).
  const slots: Slot[] = []
  for (let f = 1; f < last; f++) {
    if (f === last - 1) continue
    for (let i = 0; i < widths[f]!; i++) slots.push({ floor: f, idx: i })
  }

  // 1. Place the single elite within the allowed floor band (must not land on the infirmary floor).
  const eliteFloors: number[] = []
  for (let f = Math.max(1, BALANCE.map.eliteMinFloor); f <= last - 2; f++) {
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
    if (pool.length === 0) throw new Error(`not enough middle slots to guarantee a ${must} node`)
    const s = rng.pick(pool)
    setCat(cats, s.floor, s.idx, must)
    used.add(key(s.floor, s.idx))
  }

  // 3. Fill the rest with weighted fillers (recruit-biased when team incomplete).
  //    Dedup: never leave a floor entirely one node type when it has >1 node and an
  //    alternative filler exists. Guaranteed nodes (elite/recruit/relic) count toward
  //    the floor's type set, so most floors are already mixed; this only catches the
  //    all-filler-same case (e.g. 3-wide floor rolling battle/battle/battle).
  const freeByFloor = new Map<number, Slot[]>()
  for (const s of free()) freeByFloor.set(s.floor, [...(freeByFloor.get(s.floor) ?? []), s])
  for (const [floor, floorSlots] of freeByFloor) {
    for (const s of floorSlots) {
      setCat(cats, s.floor, s.idx, pickFiller(rng, bias))
      used.add(key(s.floor, s.idx))
    }
    // If the whole floor collapsed to one type, re-roll the last slot until it differs.
    const types = cats[floor]!
    const width = types.length
    if (width > 1 && types.every(t => t === types[0])) {
      const last = floorSlots[floorSlots.length - 1]
      if (last) {
        for (let tries = 0; tries < 8; tries++) {
          const alt = pickFiller(rng, bias)
          if (alt !== types[0]) { setCat(cats, last.floor, last.idx, alt); break }
        }
      }
    }
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
