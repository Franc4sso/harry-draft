import type { RunNodeType } from '@/types'
import type { Rng } from './rng'
import { BALANCE } from '@/data/constants'

export interface AreaBias {
  teamSize: number
  teamMax: number
}

type Filler = 'battle' | 'recruit' | 'relic' | 'event' | 'spellForge'

/** Flat list of (floor, idx) coordinates for the middle floors only. */
interface Slot { floor: number; idx: number }

/**
 * Assign a category to every node of an area.
 * Hard guarantees: floor 0 = battle; last floor = boss; floor last-1 (pre-boss floor,
 * width 3) has exactly one 'infirmary' node among its 3 slots (heals the team before
 * every boss) plus 2 other filler nodes (battle/recruit/relic) — infirmary never
 * appears on any other floor; exactly one elite in a mid floor within
 * [eliteMinFloor, last-2] (never on the pre-boss floor); at least one relic among the
 * remaining middle nodes.
 * Recruit nodes are DELIBERATELY RARE (USER DIRECTIVE, "the game must be hard, recruit
 * nodes must be rare"): recruit is NOT guaranteed (an area may have zero), and is HARD
 * CAPPED at exactly one per area regardless of weighted rolls — any filler roll that
 * would place a 2nd recruit in the same area becomes a battle instead. Remaining
 * middle nodes are weighted fillers (battle/recruit/relic), with a (now small) recruit
 * bias when the team is incomplete.
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

  // Collect middle slots — INCLUDING floor last-1 (pre-boss floor is now width 3 too).
  const slots: Slot[] = []
  for (let f = 1; f < last; f++) {
    for (let i = 0; i < widths[f]!; i++) slots.push({ floor: f, idx: i })
  }

  const used = new Set<string>()

  // 1. Guarantee exactly one Infermeria on the pre-boss floor (last-1), picking one of
  //    its slots at random. Infirmary is ONLY ever placed here — never elsewhere.
  if (last - 1 >= 1 && widths[last - 1]! > 0) {
    const infirmaryIdx = rng.int(0, widths[last - 1]! - 1)
    setCat(cats, last - 1, infirmaryIdx, 'infirmary')
    used.add(key(last - 1, infirmaryIdx))
  }

  // 2. Place the single elite within the allowed floor band (excludes last-1, so it can
  //    never land on the infirmary's floor).
  const eliteFloors: number[] = []
  for (let f = Math.max(1, BALANCE.map.eliteMinFloor); f <= last - 2; f++) {
    if (widths[f]! > 0) eliteFloors.push(f)
  }
  const eliteFloor = rng.pick(eliteFloors)
  const eliteIdx = rng.int(0, widths[eliteFloor]! - 1)
  setCat(cats, eliteFloor, eliteIdx, 'elite')
  used.add(key(eliteFloor, eliteIdx))

  // 3. Guarantee >=1 relic among the remaining middle slots. Recruit is NOT
  //    guaranteed here (USER DIRECTIVE: recruit nodes must be rare, some areas zero).
  const free = () => slots.filter(s => !used.has(key(s.floor, s.idx)))
  {
    const pool = free()
    if (pool.length === 0) throw new Error(`not enough middle slots to guarantee a relic node`)
    const s = rng.pick(pool)
    setCat(cats, s.floor, s.idx, 'relic')
    used.add(key(s.floor, s.idx))
  }

  // 4. Fill the rest with weighted fillers (recruit-biased when team incomplete),
  //    enforcing a HARD CAP of at most one recruit node per area: any filler roll that
  //    would place a 2nd recruit downgrades to 'battle' instead.
  //    Dedup: never leave a floor entirely one node type when it has >1 node and an
  //    alternative filler exists. Guaranteed nodes (elite/recruit/relic) count toward
  //    the floor's type set, so most floors are already mixed; this only catches the
  //    all-filler-same case (e.g. 3-wide floor rolling battle/battle/battle).
  let recruitCount = 0
  const rollFiller = (): Filler => {
    const cat = pickFiller(rng, bias)
    if (cat === 'recruit') {
      if (recruitCount >= 1) return 'battle'
      recruitCount++
    }
    return cat
  }
  const freeByFloor = new Map<number, Slot[]>()
  for (const s of free()) freeByFloor.set(s.floor, [...(freeByFloor.get(s.floor) ?? []), s])
  for (const [floor, floorSlots] of freeByFloor) {
    for (const s of floorSlots) {
      setCat(cats, s.floor, s.idx, rollFiller())
      used.add(key(s.floor, s.idx))
    }
    // If the whole floor collapsed to one type, re-roll the last slot until it differs.
    // A weighted re-roll can (rarely) miss 8 tries in a row when one category now
    // dominates the weights (e.g. relic at 50 vs battle 25/recruit 10) — guarantee the
    // dedup by falling back to an explicit different category rather than leaving the
    // floor all-same.
    const types = cats[floor]!
    const width = types.length
    if (width > 1 && types.every(t => t === types[0])) {
      const last = floorSlots[floorSlots.length - 1]
      if (last) {
        let broke = false
        for (let tries = 0; tries < 8; tries++) {
          const alt = rollFiller()
          if (alt !== types[0]) { setCat(cats, last.floor, last.idx, alt); broke = true; break }
        }
        if (!broke) {
          const fallback: Filler = types[0] === 'battle' ? 'relic' : 'battle'
          setCat(cats, last.floor, last.idx, fallback)
        }
      }
    }
  }

  return cats
}

function pickFiller(rng: Rng, bias: AreaBias): Filler {
  const cw = BALANCE.map.categoryWeights
  const recruitW = cw.recruit + (bias.teamSize < bias.teamMax ? BALANCE.map.recruitBiasBoost : 0)
  const entries: [Filler, number][] = [['battle', cw.battle], ['recruit', recruitW], ['relic', cw.relic], ['event', cw.event], ['spellForge', cw.spellForge]]
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
