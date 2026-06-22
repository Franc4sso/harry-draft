export interface Rng {
  next(): number
  int(min: number, max: number): number
  chance(p: number): boolean
  pick<T>(arr: readonly T[]): T
  shuffle<T>(arr: readonly T[]): T[]
  fork(salt: number): Rng
}

export function seedFromString(s: string): number {
  let h = 1779033703 ^ s.length
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return (h >>> 0) || 1
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function createRng(seed: number | string): Rng {
  const numeric = typeof seed === 'string' ? seedFromString(seed) : (seed >>> 0) || 1
  const gen = mulberry32(numeric)
  const rng: Rng = {
    next: () => gen(),
    int: (min, max) => min + Math.floor(gen() * (max - min + 1)),
    chance: (p) => gen() < p,
    pick: <T>(arr: readonly T[]): T => {
      if (arr.length === 0) throw new Error('pick on empty array')
      const idx = Math.floor(gen() * arr.length)
      return arr[idx]!
    },
    shuffle: <T>(arr: readonly T[]): T[] => {
      const out = [...arr]
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(gen() * (i + 1))
        const tmp = out[i]!
        out[i] = out[j]!
        out[j] = tmp
      }
      return out
    },
    fork: (salt) => createRng((numeric ^ Math.imul(salt + 1, 2654435761)) >>> 0),
  }
  return rng
}
